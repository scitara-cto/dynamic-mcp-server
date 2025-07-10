import { Request } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { SessionInfo, Transport, TransportStorage } from "../types.js";
import logger from "../../utils/logger.js";

interface SessionMetadata {
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  transportType: 'SSE' | 'StreamableHTTP';
  userEmail: string;
  isActive: boolean;
  clientInfo?: {
    name: string;
    version: string;
  };
}

export class SessionManager {
  private transports: TransportStorage = {};
  private sessionManager: DynamicMcpServer;
  private sessionMetadata: Map<string, SessionMetadata> = new Map();
  private sessionCleanupInterval: NodeJS.Timeout;
  // Track the latest session for each user+client combination to handle race conditions
  // This ensures all requests route to the most recent session per user+client,
  // solving the issue where concurrent initialization creates multiple sessions
  // and tool responses go to the wrong session, while supporting multiple clients per user
  private latestSessionByUserAndClient: Map<string, string> = new Map(); // userEmail:clientId -> sessionId

  constructor(sessionManager: DynamicMcpServer) {
    this.sessionManager = sessionManager;
    
    // Start periodic session health check
    this.sessionCleanupInterval = setInterval(() => {
      this.checkSessionHealth();
    }, 30000); // Check every 30 seconds
    
    logger.info("[SESSION] SessionManager initialized with health monitoring");
  }

  /**
   * Get transport by session ID
   */
  getTransport(sessionId: string): Transport | undefined {
    return this.transports[sessionId];
  }

  /**
   * Get session metadata by session ID
   */
  getSessionMetadata(sessionId: string): SessionMetadata | undefined {
    return this.sessionMetadata.get(sessionId);
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
    logger.debug(`[SESSION] Transport stored for session: ${sessionId}`);
  }

  /**
   * Create a client identifier from client info
   */
  createClientId(clientInfo?: { name: string; version: string }): string {
    if (!clientInfo) {
      return 'unknown-client';
    }
    return `${clientInfo.name}:${clientInfo.version}`;
  }

  /**
   * Create a user+client key for session tracking
   */
  private createUserClientKey(userEmail: string, clientInfo?: { name: string; version: string }): string {
    const clientId = this.createClientId(clientInfo);
    return `${userEmail}:${clientId}`;
  }

  /**
   * Get the latest session ID for a user+client combination
   */
  getLatestSessionForUserAndClient(userEmail: string, clientInfo?: { name: string; version: string }): string | undefined {
    const key = this.createUserClientKey(userEmail, clientInfo);
    return this.latestSessionByUserAndClient.get(key);
  }

  /**
   * Set the latest session for a user+client combination
   */
  setLatestSessionForUserAndClient(userEmail: string, sessionId: string, clientInfo?: { name: string; version: string }): void {
    const key = this.createUserClientKey(userEmail, clientInfo);
    this.latestSessionByUserAndClient.set(key, sessionId);
    const clientId = this.createClientId(clientInfo);
    logger.debug(`[SESSION] Set latest session for user ${userEmail}, client ${clientId}: ${sessionId}`);
  }

  /**
   * Get the latest transport for a user+client combination (convenience method)
   */
  getLatestTransportForUserAndClient(userEmail: string, clientInfo?: { name: string; version: string }): Transport | undefined {
    const latestSessionId = this.getLatestSessionForUserAndClient(userEmail, clientInfo);
    return latestSessionId ? this.getTransport(latestSessionId) : undefined;
  }

  /**
   * Legacy method: Get the latest session ID for a user (uses first available client)
   * @deprecated Use getLatestSessionForUserAndClient instead
   */
  getLatestSessionForUser(userEmail: string): string | undefined {
    // Find any session for this user (backward compatibility)
    for (const [key, sessionId] of this.latestSessionByUserAndClient.entries()) {
      if (key.startsWith(`${userEmail}:`)) {
        return sessionId;
      }
    }
    return undefined;
  }

  /**
   * Legacy method: Set the latest session for a user (without client info)
   * @deprecated Use setLatestSessionForUserAndClient instead
   */
  setLatestSessionForUser(userEmail: string, sessionId: string): void {
    // For backward compatibility, use unknown client
    this.setLatestSessionForUserAndClient(userEmail, sessionId, undefined);
  }

  /**
   * Update client info for an existing session
   */
  updateSessionClientInfo(sessionId: string, clientInfo: { name: string; version: string }): void {
    const metadata = this.sessionMetadata.get(sessionId);
    if (metadata) {
      metadata.clientInfo = clientInfo;
      this.setLatestSessionForUserAndClient(metadata.userEmail, sessionId, clientInfo);
    }
  }

  /**
   * Legacy method: Get the latest transport for a user (uses first available client)
   * @deprecated Use getLatestTransportForUserAndClient instead
   */
  getLatestTransportForUser(userEmail: string): Transport | undefined {
    const latestSessionId = this.getLatestSessionForUser(userEmail);
    return latestSessionId ? this.getTransport(latestSessionId) : undefined;
  }

  /**
   * Remove transport and clean up session
   */
  removeSession(sessionId: string): void {
    const metadata = this.sessionMetadata.get(sessionId);
    if (metadata) {
      const duration = Date.now() - metadata.createdAt.getTime();
      logger.info(`[SESSION] Removing session: ${sessionId}, duration: ${Math.round(duration/1000)}s, user: ${metadata.userEmail}`);
      this.sessionMetadata.delete(sessionId);
    } else {
      logger.warn(`[SESSION] Removing session without metadata: ${sessionId}`);
    }
    
    delete this.transports[sessionId];
    this.sessionManager.removeSessionInfo(sessionId);
  }

  /**
   * Create SSE session with the given transport and request
   */
  async createSSESession(transport: SSEServerTransport, req: Request, clientInfo?: { name: string; version: string }): Promise<void> {
    // Use user info from API key auth logic
    const userInfo = (req as any).user;
    if (!userInfo) {
      logger.warn("[SESSION] No user info found in request during session creation");
      return;
    }
    
    const now = new Date();
    const clientId = this.createClientId(clientInfo);
    logger.debug(`[SESSION] Creating SSE session: ${transport.sessionId} for user: ${userInfo.email}, client: ${clientId}`);

    // Create session metadata
    const metadata: SessionMetadata = {
      sessionId: transport.sessionId,
      createdAt: now,
      lastActivity: now,
      transportType: 'SSE',
      userEmail: userInfo.email,
      isActive: true,
      clientInfo
    };
    this.sessionMetadata.set(transport.sessionId, metadata);

    // Create session info with user
    const sessionInfo: SessionInfo = {
      sessionId: transport.sessionId,
      user: userInfo,
      token: userInfo.apiKey,
      mcpServer: this.sessionManager,
    };

    // Store auth info in session manager
    this.sessionManager.setSessionInfo(transport.sessionId, sessionInfo);

    // Track this as the latest session for the user+client combination
    this.setLatestSessionForUserAndClient(userInfo.email, transport.sessionId, clientInfo);

    // Store the transport
    this.storeTransport(transport.sessionId, transport);

    // Clean up when the connection closes
    transport.onclose = () => {
      logger.warn(`[SESSION] SSE Transport closed unexpectedly: ${transport.sessionId}`);
      this.markSessionInactive(transport.sessionId);
      this.removeSession(transport.sessionId);
    };
  }

  /**
   * Create StreamableHTTP session info
   */
  createStreamableHTTPSessionInfo(sessionId: string, user: any, clientInfo?: { name: string; version: string }): void {
    const now = new Date();
    const clientId = this.createClientId(clientInfo);
    logger.debug(`[SESSION] Creating StreamableHTTP session: ${sessionId} for user: ${user.email}, client: ${clientId}`);

    // Create session metadata
    const metadata: SessionMetadata = {
      sessionId,
      createdAt: now,
      lastActivity: now,
      transportType: 'StreamableHTTP',
      userEmail: user.email,
      isActive: true,
      clientInfo
    };
    this.sessionMetadata.set(sessionId, metadata);

    const sessionInfo: SessionInfo = {
      sessionId,
      user,
      token: user.apiKey,
      mcpServer: this.sessionManager,
    };
    this.sessionManager.setSessionInfo(sessionId, sessionInfo);

    // Track this as the latest session for the user+client combination
    this.setLatestSessionForUserAndClient(user.email, sessionId, clientInfo);
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
        logger.debug(`[SESSION] Notified client ${sessionId} of tool changes`);
        this.updateLastActivity(sessionId);
      } catch (error) {
        logger.warn(
          `[SESSION] Failed to notify client ${sessionId} of tool changes: ${error}`,
        );
        this.markSessionInactive(sessionId);
      }
    }
  }

  /**
   * Update last activity timestamp for a session
   */
  updateLastActivity(sessionId: string): void {
    const metadata = this.sessionMetadata.get(sessionId);
    if (metadata) {
      metadata.lastActivity = new Date();
      metadata.isActive = true;
    }
  }

  /**
   * Mark a session as inactive
   */
  markSessionInactive(sessionId: string): void {
    const metadata = this.sessionMetadata.get(sessionId);
    if (metadata) {
      metadata.isActive = false;
      logger.warn(`[SESSION] Marked session as inactive: ${sessionId}, user: ${metadata.userEmail}`);
    }
  }

  /**
   * Check session health and clean up stale sessions
   */
  private checkSessionHealth(): void {
    const now = new Date();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    
    let activeCount = 0;
    let staleCount = 0;
    
    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      const timeSinceActivity = now.getTime() - metadata.lastActivity.getTime();
      
      if (timeSinceActivity > staleThreshold) {
        logger.warn(`[SESSION] Removing stale session: ${sessionId}, inactive for ${Math.round(timeSinceActivity/1000)}s, user: ${metadata.userEmail}`);
        this.removeSession(sessionId);
        staleCount++;
      } else if (timeSinceActivity > inactiveThreshold && metadata.isActive) {
        logger.info(`[SESSION] Session becoming inactive: ${sessionId}, idle for ${Math.round(timeSinceActivity/1000)}s, user: ${metadata.userEmail}`);
        this.markSessionInactive(sessionId);
      } else if (metadata.isActive) {
        activeCount++;
      }
    }
    
    if (activeCount > 0 || staleCount > 0) {
      logger.debug(`[SESSION] Health check: ${activeCount} active sessions, ${staleCount} stale sessions removed`);
    }
  }

  /**
   * Get session statistics for debugging
   */
  getSessionStats(): { active: number; inactive: number; total: number; sessions: SessionMetadata[] } {
    const sessions = Array.from(this.sessionMetadata.values());
    const active = sessions.filter(s => s.isActive).length;
    const inactive = sessions.filter(s => !s.isActive).length;
    
    return {
      active,
      inactive,
      total: sessions.length,
      sessions
    };
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    logger.info("[SESSION] SessionManager destroyed");
  }
}