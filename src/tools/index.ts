import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { orchestrationTools } from "./orchestrations/index.js";
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
import { ToolOutput } from "./types.js";

const toolList = [...orchestrationTools];

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

// Type for tool definitions
type ToolDefinition = {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
  };
  handler: (...args: any[]) => Promise<any>;
  annotations?: Record<string, unknown>;
};

/**
 * ToolGenerator class responsible for registering all tools with an MCP server
 */
export class ToolGenerator {
  private server: Server;
  private tools: Map<string, ToolDefinition> = new Map();
  private mcpServer: McpServer;
  private initialized: boolean = false;

  constructor(server: Server, mcpServer: McpServer) {
    this.server = server;
    this.mcpServer = mcpServer;
  }

  /**
   * Initialize all tool groups
   * This method should be updated as new tool groups are added
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Add each tool group to the array
      for (const tool of toolList) {
        await this.registerTool(tool);
      }

      // Set up handlers once after all tools are registered
      await this.setupToolHandlers();
      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize tool groups: ${error}`);
      throw error; // Re-throw to allow proper error handling upstream
    }
  }

  /**
   * Registers a tool with the MCP server
   * @param tool The tool definition to register
   */
  public async registerTool(tool: ToolDefinition): Promise<void> {
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

  wrapToolExecute(execute: (...args: any[]) => Promise<ToolOutput>) {
    const self = this;
    return async function wrapped(
      this: ToolGenerator,
      args: any,
      context: any,
    ) {
      try {
        // Pass the ToolGenerator instance to the execute function
        const toolOutput = await execute(args, context, self);
        const response: Record<string, unknown> = {
          result: toolOutput.result,
        };

        if (toolOutput.message) {
          response.message = toolOutput.message;
        }

        if (toolOutput.nextSteps) {
          response.nextSteps = toolOutput.nextSteps;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            } as { [x: string]: unknown; type: "text"; text: string },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            } as { [x: string]: unknown; type: "text"; text: string },
          ],
          isError: true,
        };
      }
    };
  }
}
