import express, { Request, Response, RequestHandler } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import {
  handleProtectedResourceMetadata,
  handleAuthorizationServerMetadata,
} from "./discovery.js";

// Store active transports
const transports: { [sessionId: string]: SSEServerTransport } = {};

export class HttpServer {
  private app: express.Application;
  private mcpServer: Server;
  private authMiddleware: RequestHandler;

  constructor(mcpServer: Server, authMiddleware: RequestHandler) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // OAuth discovery endpoints (no auth required)
    this.app.get(
      "/.well-known/oauth-protected-resource",
      handleProtectedResourceMetadata,
    );
    this.app.get(
      "/.well-known/oauth-authorization-server",
      handleAuthorizationServerMetadata,
    );

    // Apply authentication middleware to MCP endpoints
    this.app.use("/sse", this.authMiddleware);
    this.app.use("/messages", this.authMiddleware);

    // SSE endpoint
    this.app.get("/sse", async (req: Request, res: Response) => {
      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Create a new SSE transport
      const transport = new SSEServerTransport("/messages", res);
      logger.info(`Transport created: ${transport.sessionId}`);

      // Store the transport
      transports[transport.sessionId] = transport;

      // Clean up when the connection closes
      res.on("close", () => {
        logger.info(`Transport closed: ${transport.sessionId}`);
        delete transports[transport.sessionId];
      });

      // Connect the transport to the server
      await this.mcpServer.connect(transport);

      // Add debug logging for messages
      const originalOnMessage = transport.onmessage;
      transport.onmessage = (message: any) => {
        logger.debug(`SSE message for ${transport.sessionId}:`, message);
        originalOnMessage?.(message);
      };
    });

    // Message endpoint for handling MCP messages
    this.app.post("/messages", async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      logger.info(`Received message for session: ${sessionId}`);

      const transport = transports[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        logger.error(`No transport found for sessionId: ${sessionId}`);
        res.status(400).send("No transport found for sessionId");
      }
    });

    // Debug endpoint to list active sessions
    this.app.get(
      "/sessions",
      this.authMiddleware,
      (_req: Request, res: Response) => {
        res.json({
          activeSessions: Object.keys(transports),
          count: Object.keys(transports).length,
        });
      },
    );

    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });
  }

  public start(): void {
    this.app.listen(config.server.port, () => {
      logger.info(`MCP server started on port ${config.server.port}`);
    });
  }
}
