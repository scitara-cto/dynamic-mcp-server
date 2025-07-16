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
    logger.debug(`[SESSION] Cleaning up session: ${sessionId}`);
    
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
      logger.debug(`[SESSION] Invalidating existing session ${existingSessionId} for user: ${userEmail}`);
      cleanupSession(existingSessionId);
    }
  };


  // Helper function to create a new session
  const createNewSession = async (sessionId: string, userEmail: string, userApiKey: string, clientName: string = 'unknown-client', clientVersion: string = 'unknown-version') => {
    
    // Enforce single session per user - invalidate any existing sessions for this user
    invalidateUserSessions(userEmail, sessionId);
    
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (newSessionId: string) => {
        logger.info(
          `[SESSION] New session initialized: ${newSessionId} for user: ${userEmail} using ${clientName} ${clientVersion}`,
        );
        
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


  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    logger.debug(`[SESSION] ${req.method} request for session: ${sessionId}`);
    
    // Check for session ID
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

    // Check if session exists
    const sessionData = sessions[sessionId];
    if (!sessionData) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid or missing session ID',
        },
        id: null,
      });
      return;
    }

    // Update last used timestamp
    updateSessionLastUsed(sessionId);

    // Handle the request with the existing transport
    const transport = sessionData.transport;
    await transport.handleRequest(req, res);
  };

  // Handle GET requests for server-to-client notifications via streamable HTTP
  router.get('/mcp', handleSessionRequest);

  // Handle DELETE requests for session termination
  router.delete('/mcp', handleSessionRequest);

  // Handle POST requests for client-to-server communication
  router.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    // Log session requests for monitoring
    logger.debug(`[SESSION] POST request - sessionId: ${sessionId}, method: ${req.body?.method || 'unknown'}`);

    if (sessionId && sessions[sessionId]) {
      // Reuse existing transport
      transport = sessions[sessionId].transport;
      updateSessionLastUsed(sessionId);
    } else if (!sessionId && isInitializeRequest(req.body)) {
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
      
      logger.debug(`[SESSION] INIT REQUEST for user: ${authResult.user.email}, client: ${clientName} v${clientVersion}`);

      // Check if user already has an active session and invalidate it
      const existingActiveSessionId = userActiveSession[authResult.user.email];
      if (existingActiveSessionId) {
        logger.debug(`[SESSION] User ${authResult.user.email} already has active session ${existingActiveSessionId}, invalidating`);
        invalidateUserSessions(authResult.user.email);
      }
      
      // Generate new session ID and create transport
      const newSessionId = randomUUID();
      logger.debug(`[SESSION] Creating new session: ${newSessionId} for user: ${authResult.user.email}`);
      transport = await createNewSession(newSessionId, authResult.user.email, authResult.user.apiKey, clientName, clientVersion);
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  });

  return router;
}

// Export helper functions for notification support
export const getActiveTransports = (): StreamableHTTPServerTransport[] => {
  return Object.values(sessions).map(sessionData => sessionData.transport);
};

export const getTransport = (sessionId: string): StreamableHTTPServerTransport | undefined => {
  return sessions[sessionId]?.transport;
};
