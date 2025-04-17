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

  /**
   * Create a new ToolGenerator
   * @param server The MCP server instance to register tools with
   */
  constructor(server: Server) {
    this.server = server;
    this.initializeToolGroups();
  }

  /**
   * Initialize all tool groups
   * This method should be updated as new tool groups are added
   */
  private initializeToolGroups(): void {
    // Add each tool group to the array
    orchestrationTools.forEach((tool) => {
      this.tools.set(tool.name, {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        handler: wrapToolExecute(tool.handler),
        annotations: (tool as any).annotations,
      });
    });
  }

  /**
   * Register all tools with the MCP server
   * @returns The number of tools registered
   */
  async registerAllTools(): Promise<number> {
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

          const result = await tool.handler(args);
          return result satisfies z.infer<typeof CallToolResultSchema>;
        },
      );

      logger.info(`Successfully registered ${this.tools.size} tools`);
      return this.tools.size;
    } catch (error: any) {
      logger.error(
        `Failed to register tools: ${error?.message || "Unknown error"}`,
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
}

// Centralized response wrapper for MCP tools
export function wrapToolExecute(execute: (...args: any[]) => Promise<any>) {
  return async function wrapped(...handlerArgs: any[]) {
    try {
      const result = await execute(...handlerArgs);
      return {
        content: [
          {
            type: "text",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
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
