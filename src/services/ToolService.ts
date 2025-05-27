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
        async (request: ListToolsRequest, extra: RequestHandlerExtra) => {
          const context = this.mcpServer.getSessionInfo(extra.sessionId);
          const userEmail = context.user?.email;
          if (!userEmail) {
            return { tools: [], total: 0 };
          }
          const tools = await this.userRepository.getUserTools(userEmail);
          return {
            tools,
            total: tools.length,
          };
        },
      );

      this.server.setRequestHandler(
        CallToolRequestSchema,
        async (request: CallToolRequest, extra: RequestHandlerExtra) => {
          const context = this.mcpServer.getSessionInfo(extra.sessionId);
          const userEmail = context.user?.email;
          if (!userEmail) {
            return this.createErrorResponse("No user email in session.");
          }
          const tools = await this.userRepository.getUserTools(userEmail);
          const { name, arguments: args } = request.params;
          const tool = tools.find((t) => t.name === name);
          if (!tool) {
            return this.createErrorResponse(
              `Tool ${name} not found or not authorized for user.`,
            );
          }
          const progressToken = request.params._meta?.progressToken;
          const progressFn = this.createProgressFunction(
            extra.sessionId,
            progressToken,
          );
          try {
            const result = await this.executeTool(
              tool,
              args,
              context,
              progressFn,
            );
            return this.formatToolOutput(result);
          } catch (error) {
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

  public async executeTool(
    toolDef: any,
    args: any,
    context: any,
    progress?: (progress: number, total?: number, message?: string) => void,
  ) {
    if (!toolDef || !toolDef.handler || !toolDef.handler.type) {
      throw new Error("Tool definition missing handler type");
    }
    const userEmail = context.user?.email;
    if (!userEmail) {
      throw new Error("User context with email is required for tool execution");
    }
    // Explicit authorization check
    const authResult = await this.authorizeToolCall(userEmail, toolDef.name);
    if (!authResult.authorized) {
      throw new Error(
        authResult.error ||
          `User is not authorized to execute tool: ${toolDef.name}`,
      );
    }
    const handlerType = toolDef.handler.type;
    const handlerInstance = this.mcpServer.getHandler(handlerType);
    if (!handlerInstance) {
      throw new Error(`No handler found for type: ${handlerType}`);
    }
    
    const argMappings = toolDef.handler.config?.argMappings || {};
    const mappedArguments = mapArguments(argMappings, args, context);
    const mergedArgs = { ...mappedArguments, ...args };
    // Always pass four arguments: args, context, config, progress
    return await handlerInstance(
      mergedArgs,
      context,
      progress,
    );
  }

  public async removeTool(toolName: string): Promise<void> {
    const toolRepo = new ToolRepository();
    await toolRepo.deleteTool(toolName);
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
    logger.info(
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
}
