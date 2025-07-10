import { Request, Response, Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { SessionManager } from "../services/session-manager.js";
import { AuthService } from "../services/auth.js";
import logger from "../../utils/logger.js";

export function createStreamableHttpRoutes(
  mcpServer: Server,
  sessionManager: SessionManager,
  dynamicMcpServer: DynamicMcpServer
): Router {
  const router = Router();

  // Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
  router.all('/mcp', async (req: Request, res: Response) => {
    // Enhanced logging similar to SSE transport
    logger.debug(
      `[MCP] /mcp ${req.method} called. Query: ${JSON.stringify(
        req.query,
      )}, Headers: ${JSON.stringify(req.headers)}`,
    );
    
    // Log request body for POST requests (but limit size for security)
    if (req.method === 'POST' && req.body) {
      const bodyPreview = JSON.stringify(req.body).substring(0, 200);
      logger.debug(`[MCP] Request body preview: ${bodyPreview}${JSON.stringify(req.body).length > 200 ? '...' : ''}`);
      logger.debug(`[MCP] Request method: ${req.body.method || 'no method'}`);
    }
    
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && sessionManager.getTransport(sessionId)) {
        const existingTransport = sessionManager.getTransport(sessionId);
        if (existingTransport instanceof StreamableHTTPServerTransport) {
          transport = existingTransport;
        } else {
          // Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol',
            },
            id: null,
          });
          return;
        }
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // Handle authentication for new sessions
        const authResult = await AuthService.authenticateRequest(req);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error });
          return;
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            logger.info(`StreamableHTTP session initialized with ID: ${sessionId}`);
            sessionManager.storeTransport(sessionId, transport);
            
            // Store user info in session manager
            sessionManager.createStreamableHTTPSessionInfo(sessionId, authResult.user);
          }
        });

        sessionManager.setupStreamableHTTPCleanup(transport);

        await mcpServer.connect(transport);
        
        // Notify tool list changed after connection is ready
        await dynamicMcpServer.notifyToolListChanged(authResult.user.email);
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided or invalid request',
          },
          id: null,
        });
        return;
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP streamable HTTP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  return router;
}