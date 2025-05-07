import express, { Request, Response, RequestHandler } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { handleClientRegistration } from "./client-registration.js";
import { handleOAuthMetadata } from "./oauth-metadata.js";

export class McpHttpServer {
  private app: express.Application;
  private mcpServer: Server;
  private sessionManager: DynamicMcpServer;
  private authMiddleware: RequestHandler;
  private transports: { [sessionId: string]: SSEServerTransport } = {};

  constructor(
    mcpServer: Server,
    sessionManager: DynamicMcpServer,
    authMiddleware: RequestHandler,
  ) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.sessionManager = sessionManager;
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  private async validateOAuthToken(
    req: Request,
  ): Promise<{ valid: boolean; user: any; token: string }> {
    const authHeader = req.headers.authorization as string | undefined;
    const token = authHeader?.split(" ")[1] || "";
    const user = (req as any).user; // Already validated by middleware

    return {
      valid: !!token && !!user, // We know it's valid if we have both since middleware validated
      user,
      token,
    };
  }

  private setupRoutes(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // Apply authentication middleware to MCP endpoints
    this.app.use("/sse", this.authMiddleware);
    this.app.use("/messages", this.authMiddleware);

    // OAuth metadata endpoint (no auth required)
    this.app.get(
      "/.well-known/oauth-authorization-server",
      handleOAuthMetadata,
    );

    // Client registration endpoint (no auth required)
    this.app.post("/register", handleClientRegistration);

    // SSE endpoint
    this.app.get("/sse", async (req: Request, res: Response) => {
      // Debug logging
      logger.debug(`SSE endpoint called`);
      logger.debug(`Query parameters: ${JSON.stringify(req.query)}`);
      logger.debug(`Headers: ${JSON.stringify(req.headers)}`);
      logger.debug(`User object: ${JSON.stringify((req as any).user)}`);

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Only use OAuth authentication
      logger.debug(`Validating OAuth token`);
      const oauthResult = await this.validateOAuthToken(req);
      if (!oauthResult.valid) {
        logger.debug(`OAuth validation failed`);
        res.status(401).send("Invalid OAuth token");
        return;
      }

      // Create a new SSE transport
      const transport = new SSEServerTransport("/messages", res);
      logger.info(`Transport created: ${transport.sessionId}`);

      // Store the transport
      this.transports[transport.sessionId] = transport;

      // Inject the entire query object into sessionInfo
      const sessionInfo = {
        sessionId: transport.sessionId,
        user: oauthResult.user, // Store the entire user info
        query: req.query,
        mcpServer: this.sessionManager,
      };
      logger.debug(`Using OAuth authentication`);

      // Store auth info in session manager
      this.sessionManager.setSessionInfo(transport.sessionId, sessionInfo);

      // Clean up when the connection closes
      res.on("close", () => {
        logger.info(`Transport closed: ${transport.sessionId}`);
        delete this.transports[transport.sessionId];
        this.sessionManager.removeSessionInfo(transport.sessionId);
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
      logger.info(
        `Message for session: ${sessionId}, ${
          req?.body?.method || "no method provided"
        }`,
      );

      const transport = this.transports[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
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
          activeSessions: Object.keys(this.transports),
          count: Object.keys(this.transports).length,
        });
      },
    );

    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });
  }

  public start(): void {
    try {
      this.app.listen(config.server.port, () => {
        logger.info(`MCP server started on port ${config.server.port}`);
      });
    } catch (error) {
      logger.error(`Failed to start MCP server: ${error}`);
    }
  }

  public async notifyToolListChanged(): Promise<void> {
    for (const sessionId in this.transports) {
      const transport = this.transports[sessionId];
      try {
        await transport.send({
          jsonrpc: "2.0",
          method: "notifications/tools/list_changed",
          params: {},
        });
        logger.info(`Notified client ${sessionId} of tool changes`);
      } catch (error) {
        logger.warn(
          `Failed to notify client ${sessionId} of tool changes: ${error}`,
        );
      }
    }
  }
}
