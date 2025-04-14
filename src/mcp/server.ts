import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { config } from "../config/index.js";
import { DlxToolGenerator } from "../tools/index.js";
import logger from "../utils/logger.js";

export class McpServer {
  private server: SdkMcpServer;
  private toolGenerator: DlxToolGenerator;

  constructor() {
    this.server = new SdkMcpServer({
      name: config.server.name,
      version: config.server.version,
      authentication: {
        type: "oauth2",
        authorizationUrl: config.auth.authorizationUrl,
        tokenUrl: config.auth.tokenUrl,
        scopes: config.auth.scopes,
      },
    });

    // Initialize the tool generator
    this.toolGenerator = new DlxToolGenerator(this.server);
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

  public getServer(): Server {
    return (this.server as any)._server;
  }
}
