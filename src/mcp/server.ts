import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ToolGenerator } from "../tools/index.js";
import logger from "../utils/logger.js";

export interface SessionInfo {
  token: string;
  user: any;
  dlxApiUrl?: string;
}

export class McpServer {
  private server: Server;
  private toolGenerator: ToolGenerator;
  private sessionInfo = new Map<string, SessionInfo>();

  constructor(server: Server) {
    this.server = server;
    this.toolGenerator = new ToolGenerator(this.server, this);
  }

  /**
   * Set auth info for a session
   */
  public setSessionInfo(sessionId: string, sessionInfo: SessionInfo): void {
    this.sessionInfo.set(sessionId, sessionInfo);
  }

  /**
   * Get auth info for a session
   */
  public getSessionInfo(
    sessionId: string | undefined,
  ): SessionInfo | undefined {
    if (!sessionId) return undefined;
    return this.sessionInfo.get(sessionId);
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
      const toolCount = await this.toolGenerator.registerAllTools();
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
}
