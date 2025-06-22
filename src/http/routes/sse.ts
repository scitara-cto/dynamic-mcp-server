import { Request, Response, Router } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { SessionManager } from "../services/session-manager.js";
import { AuthService } from "../services/auth.js";
import logger from "../../utils/logger.js";

export function createSSERoutes(
  mcpServer: Server,
  sessionManager: SessionManager,
  dynamicMcpServer: DynamicMcpServer
): Router {
  const router = Router();

  // SSE endpoint with inline API key authentication
  router.get("/sse", async (req: Request, res: Response) => {
    // Debug: Log query and headers
    logger.info(
      `[DEBUG] /sse called. Query: ${JSON.stringify(
        req.query,
      )}, Headers: ${JSON.stringify(req.headers)}`,
    );

    // API key authentication logic
    const authResult = await AuthService.authenticateRequest(req);
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    (req as any).user = authResult.user;

    // Debug logging
    logger.debug(`SSE endpoint called`);
    logger.debug(`Query parameters: ${JSON.stringify(req.query)}`);
    logger.debug(`Headers: ${JSON.stringify(req.headers)}`);

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

    // Add debug logging for messages
    const originalOnMessage = transport.onmessage;
    transport.onmessage = (message: any) => {
      logger.debug(`SSE message for ${transport.sessionId}:`, message);
      originalOnMessage?.(message);
    };
  });

  // Message endpoint for handling MCP messages (no auth middleware)
  router.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    logger.info(
      `Message for session: ${sessionId}, ${
        req?.body?.method || "no method provided"
      }`,
    );

    const transport = sessionManager.getTransport(sessionId);
    if (transport) {
      if (transport instanceof SSEServerTransport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        // StreamableHTTPServerTransport doesn't use this endpoint
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
      logger.error(`No transport found for sessionId: ${sessionId}`);
      res.status(400).send("No transport found for sessionId");
    }
  });

  return router;
}