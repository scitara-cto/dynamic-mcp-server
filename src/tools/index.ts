import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../utils/logger.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListToolsResultSchema,
  CallToolResultSchema,
  ListToolsRequest,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";
import { McpServer } from "../mcp/server.js";
import { createHandler } from "./handlers/index.js";
import { tools, ToolDefinition } from "./tools.js";

// Extended tool schema that includes annotations
const ExtendedToolSchema = z
  .object({
    name: z.string(),
    description: z.optional(z.string()),
    inputSchema: z
      .object({
        type: z.literal("object"),
        properties: z.optional(z.record(z.unknown())),
      })
      .passthrough(),
    annotations: z
      .object({
        title: z.optional(z.string()),
        readOnlyHint: z.optional(z.boolean()),
        destructiveHint: z.optional(z.boolean()),
        idempotentHint: z.optional(z.boolean()),
        openWorldHint: z.optional(z.boolean()),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// Extended list tools result schema that includes annotations
const ExtendedListToolsResultSchema = ListToolsResultSchema.extend({
  tools: z.array(ExtendedToolSchema),
});

// Type for tool definitions with handler function
interface RuntimeToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
  };
  handler: (...args: any[]) => Promise<any>;
  annotations?: Record<string, unknown>;
}

/**
 * ToolGenerator class responsible for registering all tools with an MCP server
 */
export class ToolGenerator {
  private server: Server;
  private tools: Map<string, RuntimeToolDefinition> = new Map();
  private mcpServer: McpServer;
  private initialized: boolean = false;

  constructor(server: Server, mcpServer: McpServer) {
    this.server = server;
    this.mcpServer = mcpServer;
  }

  /**
   * Initialize all tools
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Add each tool to the map
      for (const tool of tools) {
        await this.registerTool(tool);
      }

      // Set up handlers once after all tools are registered
      await this.setupToolHandlers();
      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize tools: ${error}`);
      throw error; // Re-throw to allow proper error handling upstream
    }
  }

  /**
   * Registers a tool with the MCP server
   * @param tool The tool definition to register
   */
  public async registerTool({
    name,
    description,
    inputSchema,
    annotations,
    handler: { type, args },
  }: ToolDefinition): Promise<void> {
    // Create a handler function based on the tool's handler type
    const handler = createHandler(type, args);

    // Create the tool definition with the handler function
    const tool: RuntimeToolDefinition = {
      name,
      description,
      inputSchema,
      annotations,
      handler,
    };

    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: ${tool.name}`);

    // If we're already initialized, we need to re-setup the handlers
    // for dynamic tool registration
    if (this.initialized) {
      await this.setupToolHandlers();
    }
  }

  /**
   * Set up the MCP server's request handlers for tools
   * @returns The number of tools registered
   */
  async setupToolHandlers(): Promise<number> {
    try {
      // Set up the tools/list request handler
      this.server.setRequestHandler(
        ListToolsRequestSchema,
        async (request: ListToolsRequest, extra: RequestHandlerExtra) => {
          const tools = Array.from(this.tools.values()).map(
            ({ handler, ...tool }) => tool,
          );

          return {
            tools,
            total: tools.length,
          } satisfies z.infer<typeof ExtendedListToolsResultSchema>;
        },
      );

      // Set up the tools/call request handler
      this.server.setRequestHandler(
        CallToolRequestSchema,
        async (request: CallToolRequest, extra: RequestHandlerExtra) => {
          const { name, arguments: args } = request.params;
          const tool = this.tools.get(name);

          if (!tool) {
            throw new Error(`Tool ${name} not found`);
          }
          // Get auth info from McpServer
          const context = this.mcpServer.getSessionInfo(extra.sessionId);

          const result = await tool.handler(args, context);
          return result satisfies z.infer<typeof CallToolResultSchema>;
        },
      );

      // Notify clients of tool list changes after handlers are updated
      await this.mcpServer.notifyToolListChanged();

      logger.info(`Successfully set up handlers for ${this.tools.size} tools`);
      return this.tools.size;
    } catch (error: any) {
      logger.error(
        `Failed to set up tool handlers: ${error?.message || "Unknown error"}`,
      );
      return 0;
    }
  }

  /**
   * Get a list of all registered tool names
   * @returns Array of tool names
   */
  getRegisteredToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get a specific tool by name
   * @param name The name of the tool to get
   * @returns The tool instance or undefined if not found
   */
  getTool(name: string) {
    return this.tools.get(name);
  }

  /**
   * Remove a tool by name
   * @param name The name of the tool to remove
   * @returns True if the tool was removed, false if it didn't exist
   */
  async removeTool(name: string): Promise<boolean> {
    const exists = this.tools.has(name);
    if (exists) {
      this.tools.delete(name);

      // If we're already initialized, we need to re-setup the handlers
      // for dynamic tool removal
      if (this.initialized) {
        await this.setupToolHandlers();
      }

      logger.info(`Removed tool: ${name}`);
    }
    return exists;
  }
}
