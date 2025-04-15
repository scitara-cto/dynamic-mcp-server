import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { orchestrationTools } from "./orchestrations/index.js";
import logger from "../utils/logger.js";

/**
 * ToolGenerator class responsible for registering all DLX tools with an MCP server
 */
export class DlxToolGenerator {
  private server: McpServer;
  private registeredTools: Map<string, any> = new Map();
  private toolGroups: any[][] = [];

  /**
   * Create a new DlxToolGenerator
   * @param server The MCP server instance to register tools with
   */
  constructor(server: McpServer) {
    this.server = server;
    this.initializeToolGroups();
  }

  /**
   * Initialize all tool groups
   * This method should be updated as new tool groups are added
   */
  private initializeToolGroups(): void {
    // Add each tool group to the array
    this.toolGroups.push(orchestrationTools);
  }

  /**
   * Get all tools from all tool groups
   * @returns A flat array of all tools
   */
  private getAllTools(): any[] {
    return this.toolGroups.flat();
  }

  /**
   * Register all DLX tools with the MCP server
   * @returns The number of tools registered
   */
  async registerAllTools(): Promise<number> {
    logger.info("Starting to register all tools...");
    try {
      const allTools = this.getAllTools();
      logger.info(
        `Found ${allTools.length} tools across ${this.toolGroups.length} tool groups to register`,
      );

      this.registerTools(allTools);

      logger.info(
        `Successfully registered ${this.registeredTools.size} DLX tools`,
      );
      return this.registeredTools.size;
    } catch (error: any) {
      logger.error(
        `Failed to register DLX tools: ${error?.message || "Unknown error"}`,
      );
      return 0;
    }
  }

  /**
   * Register a set of tools with the MCP server
   * @param tools Array of tool configurations to register
   * @returns The number of tools registered
   */
  private registerTools(tools: any[]): number {
    let count = 0;

    for (const tool of tools) {
      try {
        // Register the tool with the server using the SDK's tool method
        const registeredTool = this.server.tool(
          tool.name,
          tool.schema,
          tool.handler,
        );

        // Store the registered tool
        this.registeredTools.set(tool.name, registeredTool);
        logger.info(`Registered tool: ${tool.name}`);
        count++;
      } catch (error: any) {
        logger.error(
          `Failed to register tool: ${error?.message || "Unknown error"}`,
        );
      }
    }

    return count;
  }

  /**
   * Get a list of all registered tool names
   * @returns Array of tool names
   */
  getRegisteredToolNames(): string[] {
    return Array.from(this.registeredTools.keys());
  }

  /**
   * Get a specific tool by name
   * @param name The name of the tool to get
   * @returns The tool instance or undefined if not found
   */
  getTool(name: string): any {
    return this.registeredTools.get(name);
  }
}
