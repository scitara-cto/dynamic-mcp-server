import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ToolGenerator } from "../tools/index.js";
import logger from "../utils/logger.js";

export interface SessionInfo {
  token: string;
  user: any;
  dlxApiUrl?: string;
  dlxApiKey?: string;
  mcpServer?: McpServer;
}

export class McpServer {
  private server: Server;
  public toolGenerator: ToolGenerator;
  private sessionInfo = new Map<string, SessionInfo>();

  constructor(server: Server) {
    this.server = server;
    this.toolGenerator = new ToolGenerator(this.server, this);
  }

  /**
   * Set auth info for a session
   */
  public setSessionInfo(sessionId: string, sessionInfo: SessionInfo): void {
    sessionInfo.mcpServer = this;
    this.sessionInfo.set(sessionId, sessionInfo);
  }

  /**
   * Get auth info for a session
   */
  public getSessionInfo(
    sessionId: string | undefined,
  ): SessionInfo | undefined {
    if (!sessionId) return undefined;
    const sessionInfo = this.sessionInfo.get(sessionId);

    // Set the mcpServer in the context if it exists
    if (sessionInfo) {
      sessionInfo.mcpServer = this;
    }

    return sessionInfo;
  }

  /**
   * Remove auth info for a session
   */
  public removeSessionInfo(sessionId: string): void {
    this.sessionInfo.delete(sessionId);
  }

  /**
   * Initialize the MCP server by registering all tools
   */
  async initialize(): Promise<void> {
    try {
      await this.toolGenerator.initialize();
      const toolCount = this.toolGenerator.getRegisteredToolNames().length;
      logger.info(`MCP server initialized with ${toolCount} tools`);
    } catch (error) {
      logger.error(`Failed to initialize MCP server: ${error}`);
      throw error;
    }
  }

  /**
   * Get the underlying server instance
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * Notify all connected clients that the tool list has changed
   */
  public async notifyToolListChanged(): Promise<void> {
    try {
      // Get all active transports from the server
      const transports = (this.server as any).transports || [];

      // Send a notification to each client
      for (const transport of transports) {
        try {
          await transport.send({
            method: "tools/listChanged",
            params: {},
          });
        } catch (error) {
          logger.warn(
            `Failed to notify client ${transport.sessionId} of tool changes: ${error}`,
          );
        }
      }
    } catch (error) {
      logger.warn(`Failed to notify clients of tool changes: ${error}`);
    }
  }
}
