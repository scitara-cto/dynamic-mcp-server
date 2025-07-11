import { Request, Response, Router } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { AuthService } from "../services/auth.js";
import logger from "../../utils/logger.js";

// Simple SSE session storage - similar to streamable HTTP approach
const sseTransports: { [sessionId: string]: SSEServerTransport } = {};

export function createSSERoutes(
  mcpServer: Server,
  dynamicMcpServer: DynamicMcpServer
): Router {
  const router = Router();

  // Helper function to clean up an SSE session
  const cleanupSSESession = (sessionId: string) => {
    logger.info(`[SSE] Cleaning up session: ${sessionId}`);
    
    // Remove from SSE transports
    delete sseTransports[sessionId];
    
    // Remove from DynamicMcpServer
    dynamicMcpServer.removeSessionInfo(sessionId);
  };

  // SSE endpoint with simplified authentication
  router.get("/sse", async (req: Request, res: Response) => {
    // Authenticate using simplified AuthService
    const authResult = await AuthService.authenticateRequest(req);
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create a new SSE transport
    const transport = new SSEServerTransport("/messages", res);
    logger.info(`[SSE] Transport created: ${transport.sessionId} for user: ${authResult.user.email}`);

    // Store transport
    sseTransports[transport.sessionId] = transport;

    // Create session info for DynamicMcpServer
    const sessionInfo = {
      sessionId: transport.sessionId,
      user: authResult.user,
      token: authResult.user.apiKey,
      mcpServer: dynamicMcpServer,
    };
    dynamicMcpServer.setSessionInfo(transport.sessionId, sessionInfo);

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      res.write(": keepalive\n\n");
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    }, 25000); // every 25 seconds

    // Clean up when HTTP response closes
    res.on("close", () => {
      logger.info(`[SSE] HTTP response closed for session: ${transport.sessionId}`);
      cleanupSSESession(transport.sessionId);
      clearInterval(heartbeatInterval);
    });

    // Setup cleanup when transport closes
    transport.onclose = () => {
      logger.info(`[SSE] Transport closed for session: ${transport.sessionId}`);
      cleanupSSESession(transport.sessionId);
      clearInterval(heartbeatInterval);
    };

    // Connect the transport to the server
    await mcpServer.connect(transport);

    // Notify tool list changed after connection is ready
    await dynamicMcpServer.notifyToolListChanged(authResult.user.email);
  });

  // Message endpoint for handling MCP messages
  router.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const method = req?.body?.method || "no method provided";
    
    logger.debug(`[SSE] Message for session: ${sessionId}, method: ${method}`);

    // Find transport in simplified storage
    const transport = sseTransports[sessionId];
    if (transport && transport instanceof SSEServerTransport) {
      try {
        await transport.handlePostMessage(req, res, req.body);
        logger.debug(`[SSE] Successfully handled message for session: ${sessionId}, method: ${method}`);
      } catch (error) {
        logger.error(`[SSE] Error handling message for session: ${sessionId}, method: ${method}, error: ${error}`);
        // Clean up on error
        cleanupSSESession(sessionId);
      }
    } else {
      logger.error(`[SSE] No SSE transport found for sessionId: ${sessionId}, method: ${method}`);
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'No valid SSE session found',
        },
        id: null,
      });
    }
  });

  return router;
}

// Export helper functions for notification support
export const getActiveSSETransports = (): SSEServerTransport[] => {
  return Object.values(sseTransports);
};

export const getSSETransport = (sessionId: string): SSEServerTransport | undefined => {
  return sseTransports[sessionId];
};