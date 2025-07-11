import { Request, Response, Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { AuthService } from "../services/auth.js";
import logger from "../../utils/logger.js";

// Simple session storage with last-used tracking
interface SessionData {
  transport: StreamableHTTPServerTransport;
  lastUsed: Date;
  userEmail: string;
  clientName: string;
  clientVersion: string;
}

const sessions: { [sessionId: string]: SessionData } = {};

// Cleanup timer constants
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const SESSION_TIMEOUT = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

// Helper function to update session last-used timestamp
const updateSessionLastUsed = (sessionId: string) => {
  if (sessions[sessionId]) {
    sessions[sessionId].lastUsed = new Date();
  }
};

export function createStreamableHttpRoutes(
  mcpServer: Server,
  dynamicMcpServer: DynamicMcpServer
): Router {
  const router = Router();

  // Helper function to clean up a session
  const cleanupSession = (sessionId: string) => {
    logger.info(`[SESSION] Cleaning up session: ${sessionId}`);
    
    // Remove from sessions
    delete sessions[sessionId];
    
    // Remove from DynamicMcpServer
    dynamicMcpServer.removeSessionInfo(sessionId);
  };

  // Helper function to create a new session
  const createNewSession = async (sessionId: string, userEmail: string, userApiKey: string, clientName: string = 'unknown-client', clientVersion: string = 'unknown-version') => {
    
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (newSessionId: string) => {
        logger.info(`[SESSION] New session initialized: ${newSessionId} for user: ${userEmail}`);
        
        // Store session data with timestamp
        sessions[newSessionId] = {
          transport,
          lastUsed: new Date(),
          userEmail,
          clientName,
          clientVersion
        };
        
        // Create session info for DynamicMcpServer
        const sessionInfo = {
          sessionId: newSessionId,
          user: { email: userEmail, apiKey: userApiKey },
          token: userApiKey,
          mcpServer: dynamicMcpServer,
        };
        dynamicMcpServer.setSessionInfo(newSessionId, sessionInfo);
      }
    });

    // Setup cleanup when transport closes
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        logger.info(`[SESSION] Transport closed for session: ${sid}`);
        cleanupSession(sid);
      }
    };

    // Connect to MCP server
    await mcpServer.connect(transport);
    
    // Notify tool list changed after connection is ready
    await dynamicMcpServer.notifyToolListChanged(userEmail);
    
    return transport;
  };

  // Helper function to validate MCP protocol version header and send error response if invalid
  const validateProtocolVersion = (req: Request, res: Response): boolean => {
    const protocolVersion = req.headers['mcp-protocol-version'] as string | undefined;
    if (protocolVersion !== '2025-06-18') {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Missing or invalid MCP-Protocol-Version header. Expected: 2025-06-18',
        },
        id: null,
      });
      return false;
    }
    return true;
  };

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    logger.debug(`[SESSION] ${req.method} request for session: ${sessionId}`);
    
    // Authenticate to get user info
    const authResult = await AuthService.authenticateRequest(req);
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    // Validate MCP protocol version header after authentication
    if (!validateProtocolVersion(req, res)) {
      return;
    }

    // Find the session
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Missing MCP-Session-ID header',
        },
        id: null,
      });
      return;
    }

    let sessionData = sessions[sessionId];
    let transport: StreamableHTTPServerTransport;
    
    if (!sessionData || !(sessionData.transport instanceof StreamableHTTPServerTransport)) {
      logger.info(`[SESSION] Session ${sessionId} not found, creating new session`);
      transport = await createNewSession(sessionId, authResult.user.email, authResult.user.apiKey);
    } else {
      transport = sessionData.transport;
      // Update last used timestamp
      updateSessionLastUsed(sessionId);
    }

    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error(`[SESSION] Error handling request for session: ${sessionId}, error: ${error}`);
      cleanupSession(sessionId);
      // Note: Don't send error response here - the transport should handle its own error responses
      // and after cleanup, the session is no longer valid for meaningful error communication
    }
  };

  // Handle GET requests for server-to-client notifications via SSE
  router.get('/mcp', handleSessionRequest);

  // Handle DELETE requests for session termination
  router.delete('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    // Authenticate to get user info
    const authResult = await AuthService.authenticateRequest(req);
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    // Validate MCP protocol version header after authentication
    if (!validateProtocolVersion(req, res)) {
      return;
    }

    if (!sessionId) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Missing MCP-Session-ID header',
        },
        id: null,
      });
      return;
    }

    // Find and terminate the session
    if (sessions[sessionId]) {
      logger.info(`[SESSION] Terminating session: ${sessionId}`);
      
      try {
        // Close the transport
        const sessionData = sessions[sessionId];
        sessionData.transport.close();
        
        // Clean up session data
        cleanupSession(sessionId);
        
        res.status(200).json({
          jsonrpc: '2.0',
          result: { message: 'Session terminated successfully' },
          id: null,
        });
      } catch (error) {
        logger.error(`[SESSION] Error terminating session: ${error}`);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error during session termination',
          },
          id: null,
        });
      }
    } else {
      logger.warn(`[SESSION] No active session found: ${sessionId}`);
      res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'No active session found to terminate',
        },
        id: null,
      });
    }
  });

  // Handle POST requests for client-to-server communication
  router.post('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      // Log session requests for monitoring
      logger.debug(`[SESSION] POST request - sessionId: ${sessionId}, method: ${req.body?.method || 'unknown'}`);

      // Validate MCP protocol version header for all requests
      // TODO: Re-enable when MCP clients consistently send the protocol version header
      // if (!validateProtocolVersion(req, res)) {
      //   return;
      // }

      if (sessionId) {
        // Existing session - authenticate and find session
        const authResult = await AuthService.authenticateRequest(req);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error });
          return;
        }

        // Use the session ID directly, create if not found
        const sessionData = sessions[sessionId];
        
        if (!sessionData) {
          transport = await createNewSession(sessionId, authResult.user.email, authResult.user.apiKey);
        } else {
          transport = sessionData.transport;
          // Update last used timestamp
          updateSessionLastUsed(sessionId);
        }
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // New initialization request
        const authResult = await AuthService.authenticateRequest(req);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error });
          return;
        }

        // Extract client information for session management
        const clientInfo = req.body?.params?.clientInfo;
        const clientName = clientInfo?.name || 'unknown-client';
        const clientVersion = clientInfo?.version || 'unknown-version';
        
        logger.info(`[SESSION] INIT REQUEST for user: ${authResult.user.email}, client: ${clientName} v${clientVersion}`);

        // Check if user already has an active session for this specific client
        const existingSession = Object.entries(sessions).find(([_, sessionData]) =>
          sessionData.userEmail === authResult.user.email &&
          sessionData.clientName === clientName
        );

        if (existingSession) {
          const [existingSessionId, sessionData] = existingSession;
          logger.info(`[SESSION] Client reconnection detected, creating fresh transport for existing session: ${existingSessionId} for user: ${authResult.user.email}, client: ${clientName}`);
          // Clean up the old transport to avoid conflicts
          cleanupSession(existingSessionId);
          // Create fresh transport but reuse the session ID to maintain continuity
          transport = await createNewSession(existingSessionId, authResult.user.email, authResult.user.apiKey, clientName, clientVersion);
        } else {
          // Generate new session ID and create transport
          const newSessionId = randomUUID();
          logger.info(`[SESSION] Creating new session: ${newSessionId} for user: ${authResult.user.email}, client: ${clientName}`);
          transport = await createNewSession(newSessionId, authResult.user.email, authResult.user.apiKey, clientName, clientVersion);
        }
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
          logger.debug(`[SESSION] Successfully handled request for session: ${sessionId}`);
        }
      } catch (requestError) {
        logger.error(`[SESSION] Error handling request for session: ${sessionId || 'new'}, error: ${requestError}`);
        if (sessionId) {
          cleanupSession(sessionId);
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

  // Start cleanup timer after all functions are defined
  const cleanupStaleSessionsTimer = setInterval(() => {
    const now = new Date();
    const staleSessionIds: string[] = [];
    
    for (const [sessionId, sessionData] of Object.entries(sessions)) {
      const timeSinceLastUse = now.getTime() - sessionData.lastUsed.getTime();
      if (timeSinceLastUse > SESSION_TIMEOUT) {
        staleSessionIds.push(sessionId);
      }
    }
    
    if (staleSessionIds.length > 0) {
      logger.info(`[SESSION] Cleaning up ${staleSessionIds.length} stale sessions older than 12 hours`);
      staleSessionIds.forEach(sessionId => {
        logger.info(`[SESSION] Removing stale session: ${sessionId} (last used: ${sessions[sessionId].lastUsed.toISOString()})`);
        cleanupSession(sessionId);
      });
    }
  }, CLEANUP_INTERVAL);

  return router;
}

// Export helper functions for notification support
export const getActiveTransports = (): StreamableHTTPServerTransport[] => {
  return Object.values(sessions).map(sessionData => sessionData.transport);
};

export const getTransport = (sessionId: string): StreamableHTTPServerTransport | undefined => {
  return sessions[sessionId]?.transport;
};