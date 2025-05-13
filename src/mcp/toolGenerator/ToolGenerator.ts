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
    logger.info(`Registered handler factory for type: ${type}`);
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
            return response;
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
      logger.info(`Tool '${toolDef.name}' already registered, skipping.`);
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

  public async addTool(
    toolDef: ToolDefinition,
    creator: string,
  ): Promise<void> {
    const toolRepo = new ToolRepository();
    await toolRepo.upsertMany([{ ...toolDef, creator }]);
  }
}
