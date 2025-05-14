import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../../utils/logger.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListToolsResultSchema,
  ListToolsRequest,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";
import { DynamicMcpServer } from "../server.js";
import { ToolDefinition, RuntimeToolDefinition } from "../types.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { SessionToolManager } from "./SessionToolManager.js";
import { ToolAuthorization } from "./ToolAuthorization.js";
import { ToolRegistry } from "./ToolRegistry.js";
import { ToolRepository } from "../../db/repositories/ToolRepository.js";

export interface HandlerOutput {
  result: any;
  message?: string;
  nextSteps?: string[];
}

export class ToolGenerator {
  private server: Server;
  private mcpServer: DynamicMcpServer;
  private userRepository: UserRepository;
  private sessionToolManager: SessionToolManager;
  private toolAuthorization: ToolAuthorization;
  private toolRegistry: ToolRegistry;
  private initialized: boolean = false;

  constructor(
    server: Server,
    mcpServer: DynamicMcpServer,
    userRepository: UserRepository,
  ) {
    this.server = server;
    this.mcpServer = mcpServer;
    this.userRepository = userRepository;
    this.toolRegistry = new ToolRegistry();
    this.sessionToolManager = new SessionToolManager(() =>
      this.toolRegistry.getRegisteredToolNames(),
    );
    this.toolAuthorization = new ToolAuthorization(this.userRepository);
  }

  public registerHandlerFactory(
    type: string,
    factory: (config: any) => any,
  ): void {
    this.toolRegistry.registerHandlerFactory(type, factory);
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
          const tools = Array.from(this.toolRegistry.getAllTools()).map(
            ({ handler, ...tool }) => tool,
          );
          return {
            tools,
            total: tools.length,
          } satisfies z.infer<typeof ListToolsResultSchema>;
        },
      );

      this.server.setRequestHandler(
        CallToolRequestSchema,
        async (request: CallToolRequest, extra: RequestHandlerExtra) => {
          const { name, arguments: args } = request.params;
          logger.info(`Tool execution requested for tool: ${name}`, { args });

          const context = this.mcpServer.getSessionInfo(extra.sessionId);

          // --- User authorization check ---
          const userEmail = context.user?.email;
          const authResult = await this.toolAuthorization.authorizeToolCall(
            userEmail,
            name,
          );
          if (!authResult.authorized) {
            return this.createErrorResponse(authResult.error);
          }

          const tool = this.toolRegistry.getTool(name);
          if (!tool) {
            logger.error(`Tool ${name} not found`);
            return this.createErrorResponse(`Tool ${name} not found`);
          }

          try {
            const response = await tool.handler(args, context);
            logger.info(
              `Tool ${name} execution successful, response: { ${Object.keys(
                response,
              ).join(", ")} }, size: ${JSON.stringify(response).length}`,
            );
            // Merge in static message/nextSteps from tool definition if not present in handler output
            const toolDef = tool;
            let parsed;
            try {
              parsed =
                typeof response === "string" ? JSON.parse(response) : response;
            } catch {
              parsed = response;
            }
            const result = parsed?.result ?? parsed;
            // Use (toolDef as any)?.message to avoid linter error if not present
            const message = parsed?.message || (toolDef as any)?.message;
            const nextSteps = parsed?.nextSteps || (toolDef as any)?.nextSteps;
            return this.formatToolOutput({ result, message, nextSteps });
          } catch (error) {
            logger.error(`Tool ${name} execution failed`, { error });
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

  public async publishTool(toolDef: ToolDefinition): Promise<void> {
    if (this.toolRegistry.getTool(toolDef.name)) {
      return;
    }
    const factory = this.toolRegistry["handlerFactory"][toolDef.handler.type];
    if (!factory) {
      throw new Error(`Unknown handler type: ${toolDef.handler.type}`);
    }
    const handler = factory(toolDef.handler.config);
    const wrappedHandler = async (args: any, context: any) => {
      try {
        const result = await handler(args, context);
        return this.formatToolOutput(result);
      } catch (error) {
        return this.createErrorResponse(error);
      }
    };
    await this.toolRegistry.registerTool({
      ...toolDef,
      handler: {
        ...toolDef.handler,
      },
    });
    const regTool = this.toolRegistry.getTool(toolDef.name);
    if (regTool) {
      regTool.handler = wrappedHandler;
    }
    logger.info(`Registered tool: ${toolDef.name}`);
  }

  public getRegisteredToolNames(): string[] {
    return this.toolRegistry.getRegisteredToolNames();
  }

  public getTool(name: string): RuntimeToolDefinition | undefined {
    return this.toolRegistry.getTool(name);
  }

  public async removeTool(name: string): Promise<boolean> {
    return await this.toolRegistry.removeTool(name);
  }

  public cleanupSession(sessionId: string): void {
    this.sessionToolManager.cleanupSession(sessionId);
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
}
