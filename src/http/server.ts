import express, { Request, Response, RequestHandler } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import {
  handleProtectedResourceMetadata,
  handleAuthorizationServerMetadata,
} from "./discovery.js";
import axios from "axios";

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

    // OAuth callback endpoint
    const handleCallback: RequestHandler = async (req, res) => {
      const { code, state } = req.query;

      if (state !== "random-state-value") {
        res.status(400).send("Invalid state parameter");
        return;
      }

      try {
        const tokenUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/token`;
        const formData = new URLSearchParams();
        formData.append("grant_type", "authorization_code");
        formData.append("client_id", config.auth.clientId);
        formData.append("client_secret", config.auth.clientSecret);
        formData.append("code", code as string);
        formData.append("redirect_uri", config.auth.redirectUri);

        const response = await axios.post(tokenUrl, formData, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        const { access_token, refresh_token } = response.data;

        // You can store the tokens in a secure way, such as in a database or a secure cookie
        // For this example, we'll just send them back to the client
        res.send(`
          <h1>Authorization Successful!</h1>
          <p>Access Token: ${access_token}</p>
          <p>Refresh Token: ${refresh_token}</p>
        `);
      } catch (error: any) {
        console.error(
          "Error exchanging code for token:",
          error.response?.data || error.message,
        );
        res.status(500).send("Error exchanging code for token");
      }
    };

    this.app.get("/callback", handleCallback);

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
    logger.info(`Starting HTTP server on port ${config.server.port}...`);
    try {
      this.app.listen(config.server.port, () => {
        logger.info(`MCP server started on port ${config.server.port}`);
      });
    } catch (error) {
      logger.error(`Failed to start HTTP server: ${error}`);
    }
  }
}
