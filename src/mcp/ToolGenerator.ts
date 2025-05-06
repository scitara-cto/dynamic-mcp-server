import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../utils/logger.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListToolsResultSchema,
  ListToolsRequest,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";
import { DynamicMcpServer } from "../mcp/server.js";
import { ToolDefinition, RuntimeToolDefinition } from "./types.js";

/**
 * Represents the expected output shape from a tool handler
 */
export interface HandlerOutput {
  result: any;
  message?: string;
  nextSteps?: string[];
}

/**
 * ToolGenerator class responsible for registering all tools with an MCP server
 */
export class ToolGenerator {
  private server: Server;
  private mcpServer: DynamicMcpServer;
  private handlerFactory: Record<string, (config: any) => any> = {};
  private tools: Map<string, RuntimeToolDefinition> = new Map();
  private sessionTools: Map<string, Set<string>> = new Map();
  private initialized: boolean = false;

  constructor(server: Server, mcpServer: DynamicMcpServer) {
    this.server = server;
    this.mcpServer = mcpServer;
  }

  /**
   * Update available tools for a session based on toolsAvailable and toolsHidden attributes
   */
  private updateSessionTools(sessionId: string, context: any): void {
    const toolsAvailable = context.user?.toolsAvailable;
    const toolsHidden = context.user?.toolsHidden || [];

    if (!toolsAvailable) {
      // If no toolsAvailable specified, allow all tools except hidden ones
      const allTools = new Set<string>(this.tools.keys());
      toolsHidden.forEach((tool: string) => allTools.delete(tool));
      this.sessionTools.set(sessionId, allTools);
      return;
    }

    // Start with available tools and remove any hidden ones
    const allowedTools = new Set<string>(toolsAvailable);
    toolsHidden.forEach((tool: string) => allowedTools.delete(tool));
    this.sessionTools.set(sessionId, allowedTools);
  }

  /**
   * Register a handler factory for a specific tool type
   */
  public registerHandlerFactory(
    type: string,
    factory: (config: any) => any,
  ): void {
    this.handlerFactory[type] = factory;
    logger.info(`Registered handler factory for type: ${type}`);
  }

  /**
   * Initialize the tool generator
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Set up the tools/list request handler
      this.server.setRequestHandler(
        ListToolsRequestSchema,
        async (request: ListToolsRequest, extra: RequestHandlerExtra) => {
          const context = this.mcpServer.getSessionInfo(extra.sessionId);
          const sessionId = extra.sessionId!; // Safe because getSessionInfo would have thrown if undefined

          // Update session tools if not already set
          if (!this.sessionTools.has(sessionId)) {
            this.updateSessionTools(sessionId, context);
          }

          const allowedTools = this.sessionTools.get(sessionId)!;
          const tools = Array.from(this.tools.values())
            .filter((tool) => allowedTools.has(tool.name))
            .map(({ handler, ...tool }) => tool);

          return {
            tools,
            total: tools.length,
          } satisfies z.infer<typeof ListToolsResultSchema>;
        },
      );

      // Set up the tools/call request handler
      this.server.setRequestHandler(
        CallToolRequestSchema,
        async (request: CallToolRequest, extra: RequestHandlerExtra) => {
          const { name, arguments: args } = request.params;
          logger.info(`Tool execution requested for tool: ${name}`, { args });

          const context = this.mcpServer.getSessionInfo(extra.sessionId);
          const sessionId = extra.sessionId!; // Safe because getSessionInfo would have thrown if undefined

          // Update session tools if not already set
          if (!this.sessionTools.has(sessionId)) {
            this.updateSessionTools(sessionId, context);
          }

          const allowedTools = this.sessionTools.get(sessionId)!;
          if (!allowedTools.has(name)) {
            logger.error(`Tool ${name} not allowed for session ${sessionId}`);
            throw new Error(
              `Tool ${name} not allowed for session ${sessionId}`,
            );
          }

          const tool = this.tools.get(name);
          if (!tool) {
            logger.error(`Tool ${name} not found`);
            throw new Error(`Tool ${name} not found`);
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
            throw error;
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

  /**
   * Helper to format tool output for MCP protocol
   */
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

  /**
   * Helper to create an error response for MCP protocol
   */
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
   * Registers a tool with the MCP server
   */
  public async registerTool({
    name,
    description,
    inputSchema,
    annotations,
    handler: { type, config },
  }: ToolDefinition): Promise<void> {
    // Use the handlerFactory to get a wrapped handler for this tool
    const factory = this.handlerFactory[type];
    if (!factory) {
      throw new Error(`Unknown handler type: ${type}`);
    }

    const handler = factory(config);
    const wrappedHandler = async (args: any, context: any) => {
      try {
        const result = await handler(args, context);
        return this.formatToolOutput(result);
      } catch (error) {
        return this.createErrorResponse(error);
      }
    };
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      annotations,
      handler: wrappedHandler,
    });

    // Update all sessions that don't have toolsAvailable restriction
    for (const [sessionId, allowedTools] of this.sessionTools.entries()) {
      if (allowedTools.size === this.tools.size - 1) {
        // -1 because we haven't added the new tool yet
        allowedTools.add(name);
      }
    }

    logger.info(`Registered tool: ${name}`);
  }

  /**
   * Get all registered tool names
   */
  public getRegisteredToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get a tool by name
   */
  public getTool(name: string): RuntimeToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Remove a tool by name
   */
  public async removeTool(name: string): Promise<boolean> {
    const result = this.tools.delete(name);
    if (result) {
      // Remove tool from all session tool sets
      for (const allowedTools of this.sessionTools.values()) {
        allowedTools.delete(name);
      }
    }
    return result;
  }

  /**
   * Clean up session tools when a session ends
   */
  public cleanupSession(sessionId: string): void {
    this.sessionTools.delete(sessionId);
  }
}
