import { Request, Response, Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { SessionManager } from "../services/session-manager.js";
import { AuthService } from "../services/auth.js";
import logger from "../../utils/logger.js";

// Session Management: Uses "latest session" approach to handle race conditions
// Multiple sessions may be created during concurrent initialization, but all requests
// are routed to the most recent session per user to ensure consistent communication

export function createStreamableHttpRoutes(
  mcpServer: Server,
  sessionManager: SessionManager,
  dynamicMcpServer: DynamicMcpServer
): Router {
  const router = Router();

  // Reusable handler for GET and DELETE requests that need existing sessions
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    logger.debug(`[SESSION] ${req.method} request for session: ${sessionId}`);
    
    // Authenticate to get user info
    const authResult = await AuthService.authenticateRequest(req);
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    // For backward compatibility, use the legacy method that finds any session for the user
    // Note: GET/DELETE requests don't contain client info, so we must use the legacy method
    const latestTransport = sessionManager.getLatestTransportForUser(authResult.user.email);
    if (!latestTransport || !(latestTransport instanceof StreamableHTTPServerTransport)) {
      logger.warn(`[SESSION] No valid latest session found for user: ${authResult.user.email} (requested: ${sessionId})`);
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'No valid session found for user',
        },
        id: null,
      });
      return;
    }

    // Note: Using legacy method here because GET/DELETE requests don't provide client info
    const latestSessionId = sessionManager.getLatestSessionForUser(authResult.user.email);
    logger.debug(`[SESSION] Using latest session for user ${authResult.user.email}: ${latestSessionId} (requested: ${sessionId})`);
    const transport = latestTransport;
    
    try {
      // Update session activity
      sessionManager.updateLastActivity(latestSessionId!);
      await transport.handleRequest(req, res);
      logger.debug(`[SESSION] Successfully handled ${req.method} request for session: ${latestSessionId}`);
    } catch (error) {
      logger.error(`[SESSION] Error handling ${req.method} request for session: ${latestSessionId}, error: ${error}`);
      sessionManager.markSessionInactive(latestSessionId!);
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
  };

  // Handle GET requests for server-to-client notifications via SSE
  router.get('/mcp', handleSessionRequest);

  // Handle DELETE requests for session termination
  router.delete('/mcp', handleSessionRequest);

  // Handle POST requests for client-to-server communication
  router.post('/mcp', async (req: Request, res: Response) => {
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId) {
        // For requests with session ID, try to use the latest session for the user
        const authResult = await AuthService.authenticateRequest(req);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error });
          return;
        }

        // Get the session metadata to extract client info
        const sessionMetadata = sessionManager.getSessionMetadata(sessionId);
        let latestTransport: StreamableHTTPServerTransport | undefined;
        
        if (sessionMetadata && sessionMetadata.clientInfo) {
          // Use client-aware lookup with the session's client info
          const clientAwareTransport = sessionManager.getLatestTransportForUserAndClient(authResult.user.email, sessionMetadata.clientInfo);
          if (clientAwareTransport && clientAwareTransport instanceof StreamableHTTPServerTransport) {
            latestTransport = clientAwareTransport;
            const latestSessionId = sessionManager.getLatestSessionForUserAndClient(authResult.user.email, sessionMetadata.clientInfo);
            sessionManager.updateLastActivity(latestSessionId!);
            logger.debug(`[SESSION] Using latest session for user ${authResult.user.email}, client ${sessionManager.createClientId(sessionMetadata.clientInfo)}: ${latestSessionId} (requested: ${sessionId})`);
          }
        } else {
          // Fallback to legacy method for sessions without client info
          const legacyTransport = sessionManager.getLatestTransportForUser(authResult.user.email);
          if (legacyTransport && legacyTransport instanceof StreamableHTTPServerTransport) {
            latestTransport = legacyTransport;
            const latestSessionId = sessionManager.getLatestSessionForUser(authResult.user.email);
            sessionManager.updateLastActivity(latestSessionId!);
            logger.debug(`[SESSION] Using latest session for user ${authResult.user.email} (legacy lookup): ${latestSessionId} (requested: ${sessionId})`);
          }
        }
        
        if (latestTransport) {
          transport = latestTransport;
        } else {
          logger.warn(`[SESSION] No valid latest session found for user: ${authResult.user.email}`);
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'No valid session found for user',
            },
            id: null,
          });
          return;
        }
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // Handle authentication for new sessions
        logger.info(`[SESSION] Creating new session - initialize request detected`);
        const authResult = await AuthService.authenticateRequest(req);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error });
          return;
        }

        // Extract client info from initialize request
        let clientInfo: { name: string; version: string } | undefined;
        if (req.body && req.body.params && req.body.params.clientInfo) {
          clientInfo = req.body.params.clientInfo;
        }

        // Create new session (multiple sessions allowed, latest will be used)
        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            logger.info(`[SESSION] StreamableHTTP session initialized with ID: ${sessionId} for user: ${authResult.user.email}`);
            logger.debug(`[SESSION] Transport created at: ${new Date().toISOString()}`);
            sessionManager.storeTransport(sessionId, newTransport);
            
            // Store user info in session manager with client info (this will automatically track as latest session for this client)
            sessionManager.createStreamableHTTPSessionInfo(sessionId, authResult.user, clientInfo);
          }
        });

        transport = newTransport;

        // Setup cleanup BEFORE connecting
        sessionManager.setupStreamableHTTPCleanup(transport);

        // Connect to MCP server FIRST (critical timing fix)
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
      if (!transport) {
        logger.error(`[SESSION] No transport available for request`);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error: No transport available',
          },
          id: null,
        });
        return;
      }

      try {
        await transport.handleRequest(req, res, req.body);
        if (sessionId) {
          logger.debug(`[SESSION] Successfully handled StreamableHTTP request for session: ${sessionId}`);
        }
      } catch (requestError) {
        logger.error(`[SESSION] Error handling request for session: ${sessionId || 'new'}, error: ${requestError}`);
        if (sessionId) {
          sessionManager.markSessionInactive(sessionId);
        }
        throw requestError;
      }
    } catch (error) {
      logger.error('[SESSION] Error handling MCP streamable HTTP request:', error);
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