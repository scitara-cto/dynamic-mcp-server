import { Request } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { SessionInfo, Transport, TransportStorage } from "../types.js";
import logger from "../../utils/logger.js";

export class SessionManager {
  private transports: TransportStorage = {};
  private sessionManager: DynamicMcpServer;

  constructor(sessionManager: DynamicMcpServer) {
    this.sessionManager = sessionManager;
  }

  /**
   * Get transport by session ID
   */
  getTransport(sessionId: string): Transport | undefined {
    return this.transports[sessionId];
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Object.keys(this.transports);
  }

  /**
   * Get count of active sessions
   */
  getSessionCount(): number {
    return Object.keys(this.transports).length;
  }

  /**
   * Store transport for a session
   */
  storeTransport(sessionId: string, transport: Transport): void {
    this.transports[sessionId] = transport;
  }

  /**
   * Remove transport and clean up session
   */
  removeSession(sessionId: string): void {
    delete this.transports[sessionId];
    this.sessionManager.removeSessionInfo(sessionId);
    logger.info(`Session removed: ${sessionId}`);
  }

  /**
   * Create SSE session with the given transport and request
   */
  async createSSESession(transport: SSEServerTransport, req: Request): Promise<void> {
    // Use user info from API key auth logic
    const userInfo = (req as any).user;
    if (!userInfo) {
      logger.warn("No user info found in request during session creation");
      return;
    }
    logger.debug(`Extracted user info for session: ${userInfo.email}`);

    // Create session info with user
    const sessionInfo: SessionInfo = {
      sessionId: transport.sessionId,
      user: userInfo,
      token: userInfo.apiKey,
      mcpServer: this.sessionManager,
    };

    // Store auth info in session manager
    this.sessionManager.setSessionInfo(transport.sessionId, sessionInfo);

    // Store the transport
    this.storeTransport(transport.sessionId, transport);

    // Clean up when the connection closes
    transport.onclose = () => {
      logger.info(`SSE Transport closed: ${transport.sessionId}`);
      this.removeSession(transport.sessionId);
    };
  }

  /**
   * Create StreamableHTTP session info
   */
  createStreamableHTTPSessionInfo(sessionId: string, user: any): void {
    const sessionInfo: SessionInfo = {
      sessionId,
      user,
      token: user.apiKey,
      mcpServer: this.sessionManager,
    };
    this.sessionManager.setSessionInfo(sessionId, sessionInfo);
  }

  /**
   * Setup StreamableHTTP transport cleanup
   */
  setupStreamableHTTPCleanup(transport: StreamableHTTPServerTransport): void {
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && this.transports[sid]) {
        logger.info(`StreamableHTTP transport closed for session ${sid}`);
        this.removeSession(sid);
      }
    };
  }

  /**
   * Notify all sessions of tool list changes
   */
  async notifyAllSessions(): Promise<void> {
    for (const sessionId in this.transports) {
      const transport = this.transports[sessionId];
      try {
        if (transport instanceof SSEServerTransport) {
          await transport.send({
            jsonrpc: "2.0",
            method: "notifications/tools/list_changed",
            params: {},
          });
        } else if (transport instanceof StreamableHTTPServerTransport) {
          await transport.send({
            jsonrpc: "2.0",
            method: "notifications/tools/list_changed",
            params: {},
          });
        }
        logger.info(`Notified client ${sessionId} of tool changes`);
      } catch (error) {
        logger.warn(
          `Failed to notify client ${sessionId} of tool changes: ${error}`,
        );
      }
    }
  }
}