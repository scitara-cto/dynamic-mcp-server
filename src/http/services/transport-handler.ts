import { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { SessionManager } from "./session-manager.js";
import { AuthService } from "./auth.js";
import logger from "../../utils/logger.js";

export interface TransportHandlerOptions {
  mcpServer: Server;
  sessionManager: SessionManager;
  dynamicMcpServer: DynamicMcpServer;
}

export class TransportHandler {
  private mcpServer: Server;
  private sessionManager: SessionManager;
  private dynamicMcpServer: DynamicMcpServer;

  constructor(options: TransportHandlerOptions) {
    this.mcpServer = options.mcpServer;
    this.sessionManager = options.sessionManager;
    this.dynamicMcpServer = options.dynamicMcpServer;
  }

  /**
   * Enhanced logging for both transport types
   */
  logRequest(req: Request, transportType: 'SSE' | 'StreamableHTTP'): void {
    logger.info(
      `[DEBUG] ${transportType} ${req.method} called. Query: ${JSON.stringify(
        req.query,
      )}, Headers: ${JSON.stringify(req.headers)}`,
    );

    // Log request body for POST requests (but limit size for security)
    if (req.method === 'POST' && req.body) {
      const bodyPreview = JSON.stringify(req.body).substring(0, 200);
      logger.info(`[${transportType}] Request body preview: ${bodyPreview}${JSON.stringify(req.body).length > 200 ? '...' : ''}`);
      logger.info(`[${transportType}] Request method: ${req.body.method || 'no method'}`);
    }
  }

  /**
   * Shared authentication logic
   */
  async authenticateRequest(req: Request): Promise<{ success: boolean; user?: any; error?: string }> {
    return await AuthService.authenticateRequest(req);
  }

  /**
   * Connect transport to MCP server and notify of tool changes
   */
  async connectAndNotify(transport: SSEServerTransport | StreamableHTTPServerTransport, userEmail: string): Promise<void> {
    // Connect the transport to the server
    await this.mcpServer.connect(transport);

    // Notify tool list changed after connection is ready
    await this.dynamicMcpServer.notifyToolListChanged(userEmail);
  }

  /**
   * Handle SSE session creation
   */
  async createSSESession(transport: SSEServerTransport, req: Request, authResult: any): Promise<void> {
    // Set user info in request for session creation
    (req as any).user = authResult.user;

    // Create session with the transport
    await this.sessionManager.createSSESession(transport, req);

    // Setup heartbeat and cleanup
    this.setupSSEHeartbeat(transport);

    // Connect and notify
    await this.connectAndNotify(transport, authResult.user.email);
  }

  /**
   * Handle StreamableHTTP session creation
   */
  async createStreamableHTTPSession(transport: StreamableHTTPServerTransport, authResult: any): Promise<void> {
    // Setup session cleanup
    this.sessionManager.setupStreamableHTTPCleanup(transport);

    // Connect and notify
    await this.connectAndNotify(transport, authResult.user.email);
  }

  /**
   * Setup SSE heartbeat mechanism
   */
  private setupSSEHeartbeat(transport: SSEServerTransport): void {
    let heartbeatCount = 0;
    const heartbeatInterval = setInterval(() => {
      heartbeatCount++;
      // Note: This assumes 'res' is available in the calling context
      // We might need to pass res as a parameter or handle this differently
    }, 15000);

    // Cleanup on transport close
    transport.onclose = () => {
      logger.info(`SSE Transport closed: ${transport.sessionId}`);
      this.sessionManager.removeSession(transport.sessionId);
      clearInterval(heartbeatInterval);
    };
  }

  /**
   * Standard error response for both transports
   */
  sendErrorResponse(res: Response, code: number, message: string, id: any = null): void {
    if (!res.headersSent) {
      res.status(code === -32000 ? 400 : 500).json({
        jsonrpc: '2.0',
        error: {
          code,
          message,
        },
        id,
      });
    }
  }

  /**
   * Standard authentication error response
   */
  sendAuthError(res: Response, error: string): void {
    res.status(401).json({ error });
  }
}