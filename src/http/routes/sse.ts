import { Request, Response, Router } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { SessionManager } from "../services/session-manager.js";
import { TransportHandler } from "../services/transport-handler.js";
import logger from "../../utils/logger.js";

export function createSSERoutes(
  mcpServer: Server,
  sessionManager: SessionManager,
  dynamicMcpServer: DynamicMcpServer
): Router {
  const router = Router();

  // SSE endpoint with inline API key authentication
  router.get("/sse", async (req: Request, res: Response) => {
    // API key authentication logic
    const authResult = await new TransportHandler({
      mcpServer,
      sessionManager,
      dynamicMcpServer
    }).authenticateRequest(req);
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    (req as any).user = authResult.user;

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create a new SSE transport
    const transport = new SSEServerTransport("/messages", res);
    logger.info(`Transport created: ${transport.sessionId}`);

    // Create session with the transport (no notification yet)
    await sessionManager.createSSESession(transport, req);

    // Also clean up on HTTP response close
    const heartbeatInterval = setInterval(() => {
      res.write(": keepalive\n\n");
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    }, 25000); // every 25 seconds

    res.on("close", () => {
      logger.info(
        `HTTP response closed for session: ${transport.sessionId}`,
      );
      sessionManager.removeSession(transport.sessionId);
      clearInterval(heartbeatInterval);
    });

    // Connect the transport to the server
    await mcpServer.connect(transport);

    // Now notify tool list changed (after connection is ready)
    await dynamicMcpServer.notifyToolListChanged(authResult.user.email);
  });

  // Message endpoint for handling MCP messages (no auth middleware)
  router.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const method = req?.body?.method || "no method provided";
    
    logger.debug(`[SESSION] Message for session: ${sessionId}, method: ${method}`);

    const transport = sessionManager.getTransport(sessionId);
    if (transport) {
      // Update session activity
      sessionManager.updateLastActivity(sessionId);
      
      // Check if this is an initialize request and extract client info
      if (method === "initialize" && req.body?.params?.clientInfo) {
        const clientInfo = req.body.params.clientInfo;
        sessionManager.updateSessionClientInfo(sessionId, clientInfo);
      }
      
      if (transport instanceof SSEServerTransport) {
        try {
          await transport.handlePostMessage(req, res, req.body);
          logger.debug(`[SESSION] Successfully handled message for session: ${sessionId}, method: ${method}`);
        } catch (error) {
          logger.error(`[SESSION] Error handling message for session: ${sessionId}, method: ${method}, error: ${error}`);
          sessionManager.markSessionInactive(sessionId);
        }
      } else {
        // StreamableHTTPServerTransport doesn't use this endpoint
        logger.warn(`[SESSION] Wrong transport type for /messages endpoint, session: ${sessionId}`);
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Session uses streamable HTTP transport, use /mcp endpoint instead',
          },
          id: null,
        });
      }
    } else {
      logger.error(`[SESSION] No transport found for sessionId: ${sessionId}, method: ${method}`);
      res.status(400).send("No transport found for sessionId");
    }
  });

  return router;
}