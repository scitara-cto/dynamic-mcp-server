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

// Track active session per user (single session per user policy)
const userActiveSession: { [userEmail: string]: string } = {};

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
    
    // Find and remove from user active session mapping
    const sessionData = sessions[sessionId];
    if (sessionData) {
      const userEmail = sessionData.userEmail;
      if (userActiveSession[userEmail] === sessionId) {
        delete userActiveSession[userEmail];
        logger.debug(`[SESSION] Removed active session mapping for user: ${userEmail}`);
      }
    }
    
    // Remove from sessions
    delete sessions[sessionId];
    
    // Remove from DynamicMcpServer
    dynamicMcpServer.removeSessionInfo(sessionId);
  };

  // Helper function to invalidate existing sessions for a user
  const invalidateUserSessions = (userEmail: string, excludeSessionId?: string) => {
    const existingSessionId = userActiveSession[userEmail];
    if (existingSessionId && existingSessionId !== excludeSessionId) {
      logger.info(`[SESSION] Invalidating existing session ${existingSessionId} for user: ${userEmail}`);
      cleanupSession(existingSessionId);
    }
  };

  // Helper function to validate if a session is the active one for the user
  const isActiveSessionForUser = (sessionId: string, userEmail: string): boolean => {
    const activeSessionId = userActiveSession[userEmail];
    const isActive = activeSessionId === sessionId;
    
    if (!isActive) {
      logger.warn(`[SESSION] Session ${sessionId} is not the active session for user ${userEmail}. Active session: ${activeSessionId || 'none'}`);
    }
    
    return isActive;
  };

  // Helper function to create a new session
  const createNewSession = async (sessionId: string, userEmail: string, userApiKey: string, clientName: string = 'unknown-client', clientVersion: string = 'unknown-version') => {
    
    // Enforce single session per user - invalidate any existing sessions for this user
    invalidateUserSessions(userEmail, sessionId);
    
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (newSessionId: string) => {
        logger.info(`[SESSION] New session initialized: ${newSessionId} for user: ${userEmail} (single-session-per-user policy)`);
        
        // Store session data with timestamp
        sessions[newSessionId] = {
          transport,
          lastUsed: new Date(),
          userEmail,
          clientName,
          clientVersion
        };
        
        // Track this as the active session for the user
        userActiveSession[userEmail] = newSessionId;
        logger.debug(`[SESSION] Set active session for user ${userEmail}: ${newSessionId}`);
        
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
        // Existing session - authenticate and validate session
        const authResult = await AuthService.authenticateRequest(req);
        if (!authResult.success) {
          res.status(401).json({ error: authResult.error });
          return;
        }

        // Check if this session is the active one for the user
        if (!isActiveSessionForUser(sessionId, authResult.user.email)) {
          // Session is not active for this user - return specific error to trigger re-initialization
          logger.warn(`[SESSION] Session ${sessionId} is not active for user ${authResult.user.email}. Active session: ${userActiveSession[authResult.user.email]}`);
          cleanupSession(sessionId);
          
          // Return a specific JSON-RPC error that indicates the client should re-initialize
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32001, // Custom error code for session invalidated
              message: 'Session invalidated: Another client has connected for this user. Please reconnect to establish a new session.',
              data: {
                reason: 'session_invalidated',
                activeSession: userActiveSession[authResult.user.email],
                invalidatedSession: sessionId
              }
            },
            id: req.body?.id || null,
          });
          return;
        } else {
          // Use the existing active session
          const sessionData = sessions[sessionId];
          
          if (!sessionData) {
            // Session data missing but marked as active - recreate
            logger.warn(`[SESSION] Active session ${sessionId} missing data, recreating for user: ${authResult.user.email}`);
            transport = await createNewSession(sessionId, authResult.user.email, authResult.user.apiKey);
          } else {
            transport = sessionData.transport;
            // Update last used timestamp
            updateSessionLastUsed(sessionId);
          }
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
        
        logger.info(`[SESSION] INIT REQUEST for user: ${authResult.user.email}, client: ${clientName} v${clientVersion} (single-session-per-user policy)`);

        // Check if user already has an active session
        const existingActiveSessionId = userActiveSession[authResult.user.email];
        
        if (existingActiveSessionId) {
          logger.info(`[SESSION] User ${authResult.user.email} already has active session ${existingActiveSessionId}, invalidating and creating new session`);
          // Invalidate existing session and create new one
          invalidateUserSessions(authResult.user.email);
        }
        
        // Generate new session ID and create transport (single session per user)
        const newSessionId = randomUUID();
        logger.info(`[SESSION] Creating new session: ${newSessionId} for user: ${authResult.user.email}, client: ${clientName}`);
        transport = await createNewSession(newSessionId, authResult.user.email, authResult.user.apiKey, clientName, clientVersion);
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
      logger.info(`[SESSION] Cleaning up ${staleSessionIds.length} stale sessions older than 12 hours (single-session-per-user policy)`);
      staleSessionIds.forEach(sessionId => {
        logger.info(`[SESSION] Removing stale session: ${sessionId} (last used: ${sessions[sessionId].lastUsed.toISOString()})`);
        cleanupSession(sessionId);
      });
    }
    
    // Also clean up orphaned user session mappings
    const orphanedUsers: string[] = [];
    for (const [userEmail, activeSessionId] of Object.entries(userActiveSession)) {
      if (!sessions[activeSessionId]) {
        orphanedUsers.push(userEmail);
      }
    }
    
    if (orphanedUsers.length > 0) {
      logger.info(`[SESSION] Cleaning up ${orphanedUsers.length} orphaned user session mappings`);
      orphanedUsers.forEach(userEmail => {
        logger.debug(`[SESSION] Removing orphaned user session mapping: ${userEmail} -> ${userActiveSession[userEmail]}`);
        delete userActiveSession[userEmail];
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