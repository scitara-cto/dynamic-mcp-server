import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { config } from "../config/index.js";
import { ToolGenerator } from "../tools/index.js";
import logger from "../utils/logger.js";

export class McpServer {
  private server: Server;
  private toolGenerator: ToolGenerator;

  constructor() {
    this.server = new Server({
      name: config.server.name,
      version: config.server.version,
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    });

    // Register the tools capability explicitly
    this.server.registerCapabilities({
      tools: {
        listChanged: true,
      },
    });

    // Initialize the tool generator
    this.toolGenerator = new ToolGenerator(this.server);
  }

  /**
   * Initialize the MCP server by registering all tools
   * @returns Promise that resolves when all tools are registered
   */
  async initialize(): Promise<void> {
    try {
      const toolCount = await this.toolGenerator.registerAllTools();
      logger.info(`MCP server initialized with ${toolCount} tools`);
    } catch (error) {
      logger.error(`Failed to initialize MCP server: ${error}`);
      throw error;
    }
  }

  /**
   * Get the underlying server instance
   * @returns The Server instance from the SDK
   */
  public getServer(): Server {
    return this.server;
  }
}
