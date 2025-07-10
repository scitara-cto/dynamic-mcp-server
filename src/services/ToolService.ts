import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../utils/logger.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListToolsRequest,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { DynamicMcpServer } from "../mcp/server.js";
import { ToolDefinition } from "../mcp/types.js";
import { UserRepository } from "../db/repositories/UserRepository.js";
import { ToolRepository } from "../db/repositories/ToolRepository.js";

export interface HandlerOutput {
  result: any;
  message?: string;
  nextSteps?: string[];
}

function mapArguments(
  argMappings: any,
  inputArgs: any,
  context: any = {},
): any {
  if (typeof argMappings === "string") {
    return argMappings.replace(/{{\s*([^}]+)\s*}}/g, (_, field) => {
      return inputArgs[field] ?? context[field] ?? process.env[field] ?? "";
    });
  } else if (Array.isArray(argMappings)) {
    return argMappings.map((item) => mapArguments(item, inputArgs, context));
  } else if (typeof argMappings === "object" && argMappings !== null) {
    const resolved: any = {};
    for (const [key, value] of Object.entries(argMappings)) {
      resolved[key] = mapArguments(value, inputArgs, context);
    }
    return resolved;
  }
  return argMappings;
}

export class ToolService {
  private server: Server;
  private mcpServer: DynamicMcpServer;
  private userRepository: UserRepository;
  private initialized: boolean = false;

  constructor(
    server: Server,
    mcpServer: DynamicMcpServer,
    userRepository: UserRepository,
  ) {
    this.server = server;
    this.mcpServer = mcpServer;
    this.userRepository = userRepository;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.server.setRequestHandler(
        ListToolsRequestSchema,
        async (
          request: ListToolsRequest,
          extra: RequestHandlerExtra<any, any>,
        ) => {
          const context = this.mcpServer.getSessionInfo(extra.sessionId);
          const userEmail = context.user?.email;
          if (!userEmail) {
            return { tools: [], total: 0 };
          }
          const tools = await this.userRepository.getUserTools(userEmail);
          // Only return tools that are not hidden (unless alwaysVisible)
          const visibleTools = tools.filter((t: any) => !t.hidden);
          return {
            tools: visibleTools,
            total: visibleTools.length,
          };
        },
      );

      this.server.setRequestHandler(
        CallToolRequestSchema,
        async (
          request: CallToolRequest,
          extra: RequestHandlerExtra<any, any>,
        ) => {
          const context = this.mcpServer.getSessionInfo(extra.sessionId);
          const userEmail = context.user?.email;
          const { name, arguments: args } = request.params;

          logger.info(
            `Tool execution requested: ${name} by user: ${
              userEmail || "unknown"
            }`,
          );
          logger.debug(`Tool execution args:`, {
            toolName: name,
            args,
            sessionId: extra.sessionId,
          });

          if (!userEmail) {
            logger.warn(
              `Tool execution failed: No user email in session for tool ${name}`,
            );
            return this.createErrorResponse("No user email in session.");
          }
          const tools = await this.userRepository.getUserTools(userEmail);
          const tool = tools.find((t) => t.name === name);
          if (!tool) {
            logger.warn(
              `Tool execution failed: Tool ${name} not found or not authorized for user ${userEmail}`,
            );
            return this.createErrorResponse(
              `Tool ${name} not found or not authorized for user.`,
            );
          }

          logger.debug(
            `Tool found: ${name}, handler type: ${tool.handler?.type}, creator: ${tool.creator}`,
          );

          const progressToken = request.params._meta?.progressToken;
          const progressFn = this.createProgressFunction(
            extra.sessionId,
            progressToken,
          );

          const startTime = Date.now();
          try {
            const result = await this.executeTool(
              tool,
              args,
              context,
              progressFn,
            );

            const executionTime = Date.now() - startTime;
            logger.info(
              `Tool execution completed: ${name} in ${executionTime}ms`,
            );
            logger.debug(`Tool execution result:`, {
              toolName: name,
              result,
              executionTime,
            });

            return this.formatToolOutput(result);
          } catch (error) {
            const executionTime = Date.now() - startTime;
            logger.error(
              `Tool execution failed: ${name} after ${executionTime}ms`,
              {
                error: error instanceof Error ? error.message : String(error),
                toolName: name,
                userEmail,
                executionTime,
              },
            );
            return this.createErrorResponse(error);
          }
        },
      );

      this.initialized = true;
      logger.info("Tool generator initialized");
    } catch (error) {
      logger.error(`Failed to initialize tool generator: ${error}`);
      throw error;
    }
  }

  private formatToolOutput(toolOutput: HandlerOutput): any {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            result: toolOutput.result,
            message: toolOutput.message,
            nextSteps: toolOutput.nextSteps,
          }),
        },
      ],
    };
  }

  private createErrorResponse(error: unknown): any {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }

  /**
   * Register a tool in the database.
   *
   * - If rolesPermitted is missing or an empty array, the tool is considered internal/hidden and will not be available to any user directly.
   * - If rolesPermitted is a non-empty array, only users with those roles will have access.
   * - name, handler, and inputSchema are always required.
   * - If creator is not provided, defaults to the server's name.
   */
  public async addTool(
    toolDef: ToolDefinition,
    creator?: string,
  ): Promise<void> {
    if (!toolDef.name) {
      throw new Error("Tool definition missing required field: name");
    }
    if (toolDef.name.includes(":")) {
      throw new Error("Tool names cannot contain ':' character");
    }
    if (!toolDef.handler) {
      throw new Error(`Tool '${toolDef.name}' missing required field: handler`);
    }
    if (!toolDef.inputSchema) {
      throw new Error(
        `Tool '${toolDef.name}' missing required field: inputSchema`,
      );
    }
    // rolesPermitted may be missing or empty for internal/hidden tools
    const toolCreator = creator || this.mcpServer.name;
    const toolRepo = new ToolRepository();
    await toolRepo.upsertMany([{ ...toolDef, creator: toolCreator }]);
  }

  public async deleteToolsByCreator(
    creator: string,
  ): Promise<{ deletedCount?: number }> {
    const toolRepo = new ToolRepository();
    return await toolRepo.deleteToolsByCreator(creator);
  }

  public async executeTool(
    toolDef: any,
    args: any,
    context: any,
    progress?: (progress: number, total?: number, message?: string) => void,
  ) {
    const toolName = toolDef?.name || "unknown";
    logger.debug(`executeTool called for: ${toolName}`);

    if (!toolDef || !toolDef.handler || !toolDef.handler.type) {
      logger.error(
        `Tool definition validation failed for ${toolName}: missing handler type`,
      );
      throw new Error("Tool definition missing handler type");
    }

    const userEmail = context.user?.email;
    if (!userEmail) {
      logger.error(
        `Tool execution failed for ${toolName}: no user email in context`,
      );
      throw new Error("User context with email is required for tool execution");
    }

    logger.debug(`Fetching fresh user data for: ${userEmail}`);
    // Always fetch the latest user record and update context.user
    const freshUser = await this.userRepository.findByEmail(userEmail);
    if (freshUser) {
      context.user = freshUser;
      logger.debug(`Updated context with fresh user data for: ${userEmail}`);
    }

    // Resolve the actual tool to execute (handle conflicts)
    const actualTool = await this.resolveToolForExecution(
      toolDef.name,
      userEmail,
    );
    logger.debug(
      `Resolved tool: ${actualTool.name} (creator: ${actualTool.creator})`,
    );

    logger.debug(
      `Authorizing tool call: ${actualTool.name} for user: ${userEmail}`,
    );
    // Explicit authorization check using the resolved tool
    const authResult = await this.authorizeToolCall(userEmail, actualTool.name);
    if (!authResult.authorized) {
      logger.warn(
        `Authorization failed for tool ${actualTool.name} and user ${userEmail}: ${authResult.error}`,
      );
      throw new Error(
        authResult.error ||
          `User is not authorized to execute tool: ${actualTool.name}`,
      );
    }
    logger.debug(
      `Authorization successful for tool ${actualTool.name} and user ${userEmail}`,
    );

    const handlerType = actualTool.handler.type;
    logger.debug(`Looking up handler for type: ${handlerType}`);
    const handlerInstance = this.mcpServer.getHandler(handlerType);
    if (!handlerInstance) {
      logger.error(`No handler found for type: ${handlerType}`);
      throw new Error(`No handler found for type: ${handlerType}`);
    }
    logger.debug(`Handler found for type: ${handlerType}`);

    const argMappings = actualTool.handler.config?.argMappings || {};
    logger.debug(`Mapping arguments for tool ${actualTool.name}`, {
      argMappings,
      originalArgs: args,
    });
    const mappedArguments = mapArguments(argMappings, args, context);
    const mergedArgs = { ...mappedArguments, ...args };
    logger.debug(`Arguments prepared for tool execution`, { mergedArgs });

    logger.info(
      `Executing handler for tool: ${actualTool.name} with handler type: ${handlerType}`,
    );
    // Always pass four arguments: args, context, config, progress
    const result = await handlerInstance(
      mergedArgs,
      context,
      actualTool.handler.config,
      progress,
    );
    logger.debug(`Handler execution completed for tool: ${actualTool.name}`, {
      result,
    });
    return result;
  }

  private async resolveToolForExecution(
    toolName: string,
    userEmail: string,
  ): Promise<any> {
    logger.debug(
      `Resolving tool for execution: ${toolName} for user: ${userEmail}`,
    );
    const tools = await this.userRepository.getUserTools(userEmail);
    logger.debug(`User has access to ${tools.length} tools total`);

    // Find tools matching the simple name
    const matchingTools = tools.filter((t: any) => t.name === toolName);
    logger.debug(
      `Found ${matchingTools.length} tools matching name: ${toolName}`,
      {
        matchingTools: matchingTools.map((t) => ({
          name: t.name,
          creator: t.creator,
        })),
      },
    );

    if (matchingTools.length === 0) {
      logger.warn(
        `No tools found matching name: ${toolName} for user: ${userEmail}`,
      );
      throw new Error(`Tool ${toolName} not found or not authorized for user.`);
    }

    if (matchingTools.length === 1) {
      logger.debug(
        `Single tool found, using: ${matchingTools[0].name} (creator: ${matchingTools[0].creator})`,
      );
      return matchingTools[0];
    }

    logger.info(
      `Multiple tools found with name ${toolName}, resolving conflict`,
    );
    // Resolve conflict: owned > shared > role-based
    return this.resolveToolConflict(matchingTools, userEmail);
  }

  private resolveToolConflict(tools: any[], userEmail: string): any {
    logger.debug(`Resolving tool conflict for user ${userEmail}`, {
      conflictingTools: tools.map((t) => ({
        name: t.name,
        creator: t.creator,
      })),
    });

    // Priority: owned > shared > role-based
    const ownedTool = tools.find((t: any) => t.creator === userEmail);
    if (ownedTool) {
      logger.info(
        `Conflict resolved: using owned tool ${ownedTool.name} (creator: ${ownedTool.creator})`,
      );
      return ownedTool;
    }

    const sharedTool = tools.find(
      (t: any) => t.creator !== userEmail && t.creator !== "system",
    );
    if (sharedTool) {
      logger.info(
        `Conflict resolved: using shared tool ${sharedTool.name} (creator: ${sharedTool.creator})`,
      );
      return sharedTool;
    }

    logger.info(
      `Conflict resolved: using fallback tool ${tools[0].name} (creator: ${tools[0].creator})`,
    );
    return tools[0]; // Fallback to first available
  }

  public async removeTool(toolName: string, creator?: string): Promise<void> {
    const toolRepo = new ToolRepository();

    let tool;
    if (creator) {
      // If creator is specified, find by name and creator
      tool = await toolRepo.findByNameAndCreator(toolName, creator);
    } else if (toolName.includes(":")) {
      // If toolName is namespaced, parse it
      tool = await toolRepo.findByNamespacedName(toolName);
    } else {
      // Fallback to original behavior for backward compatibility
      tool = await toolRepo.findByName(toolName);
    }

    if (!tool) {
      throw new Error(`Tool with name '${toolName}' not found`);
    }

    // Delete the tool from the database
    await toolRepo.deleteTool(toolName);

    // Remove the tool from hiddenTools arrays of users who had access to it
    // This prevents confusion if a tool with the same name is created later
    await this.userRepository.removeToolFromHiddenToolsForAuthorizedUsers(
      tool.name,
      tool.creator,
      tool.rolesPermitted,
    );
  }

  private async authorizeToolCall(
    userEmail: string | undefined,
    toolName: string,
  ) {
    if (!userEmail) {
      logger.error(`No user email provided for tool authorization`);
      this.auditLog("authorization_failed", userEmail, toolName, "no_email");
      return {
        authorized: false,
        error:
          "No user email found in session context. Please contact the administrator.",
      };
    }

    // Look up user in MongoDB
    const user = await this.userRepository.findByEmail(userEmail);
    if (!user) {
      logger.warn(`User not found in DB: ${userEmail}`);
      this.auditLog(
        "authorization_failed",
        userEmail,
        toolName,
        "user_not_found",
      );
      return {
        authorized: false,
        error:
          "You are not registered. Please contact the administrator to be added.",
      };
    }

    // Check tool access
    const hasAccess = await this.userRepository.checkToolAccess(
      userEmail,
      toolName,
    );
    if (!hasAccess) {
      logger.warn(`User ${userEmail} not authorized for tool ${toolName}`);
      this.auditLog(
        "authorization_failed",
        userEmail,
        toolName,
        "not_authorized",
      );
      return {
        authorized: false,
        error:
          "You are not authorized to access this tool. Please contact the administrator if you believe this is an error.",
      };
    }
    this.auditLog("authorization_success", userEmail, toolName, "authorized");
    return { authorized: true };
  }

  private auditLog(
    event: string,
    userEmail: string | undefined,
    toolName: string,
    status: string,
  ) {
    logger.debug(
      `[AUDIT] event=${event} user=${userEmail} tool=${toolName} status=${status}`,
    );
  }

  /**
   * Creates a progress function for sending progress notifications to the client session.
   */
  private createProgressFunction(
    sessionId: string | undefined,
    progressToken: string | number | undefined,
  ) {
    if (!progressToken || typeof sessionId !== "string") {
      // Always return a no-op function if progress is not supported
      return () => null;
    }
    return (progress: number, total?: number, message?: string) => {
      this.mcpServer.sendNotificationToSession(sessionId, {
        method: "notifications/progress",
        params: {
          progressToken,
          progress,
          total,
          message,
        },
      });
    };
  }

  public async updateTool(
    toolName: string,
    updates: Partial<ToolDefinition>,
  ): Promise<any> {
    const toolRepo = new ToolRepository();
    return await toolRepo.updateTool(toolName, updates);
  }
}
