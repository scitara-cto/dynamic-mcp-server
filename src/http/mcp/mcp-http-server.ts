import express, { Request, Response, RequestHandler } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config as realConfig } from "../../config/index.js";
import realLogger from "../../utils/logger.js";
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
  private config: typeof realConfig;
  private logger: typeof realLogger;

  constructor(
    mcpServer: Server,
    sessionManager: DynamicMcpServer,
    authMiddleware: RequestHandler,
    config = realConfig,
    logger = realLogger,
  ) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.sessionManager = sessionManager;
    this.authMiddleware = authMiddleware;
    this.config = config;
    this.logger = logger;
    this.setupRoutes();
  }

  /**
   * Creates a new session with the given transport and request
   */
  private async createSession(
    transport: SSEServerTransport,
    req: Request,
  ): Promise<void> {
    // Extract user info from token data
    const tokenData = (req as any).tokenData;
    const userInfo = {
      ...tokenData,
      active: tokenData.active,
      sub: tokenData.sub || "",
      email: tokenData.email || "",
      name: tokenData.name || "",
      preferred_username: tokenData.preferred_username || "",
      scope: tokenData.scope ? tokenData.scope.split(" ") : [],
      aud: tokenData.aud
        ? Array.isArray(tokenData.aud)
          ? tokenData.aud
          : [tokenData.aud]
        : [],
    };
    this.logger.debug(`Extracted user info for session: ${userInfo.sub}`);

    // Fetch MongoDB user record and merge claims
    let enrichedUser = null;
    try {
      const { UserRepository } = await import(
        "../../db/repositories/UserRepository.js"
      );
      const userRepo = new UserRepository();
      const dbUser = await userRepo.findByEmail(userInfo.email);
      if (dbUser) {
        enrichedUser = { ...dbUser, claims: userInfo };
      } else {
        this.logger.warn(`User not found in DB for session: ${userInfo.email}`);
        enrichedUser = { ...userInfo, claims: userInfo }; // fallback to JWT only
      }
    } catch (err) {
      this.logger.error(`Error fetching user from DB: ${err}`);
      enrichedUser = { ...userInfo, claims: userInfo }; // fallback to JWT only
    }

    // Create session info with enriched user and token
    const sessionInfo = {
      sessionId: transport.sessionId,
      user: enrichedUser,
      token: (req as any).token, // Store the raw token for potential future use
      mcpServer: this.sessionManager,
    };

    // Store auth info in session manager
    this.sessionManager.setSessionInfo(transport.sessionId, sessionInfo);

    // Store the transport
    this.transports[transport.sessionId] = transport;

    // Clean up when the connection closes
    transport.onclose = () => {
      this.logger.info(`Transport closed: ${transport.sessionId}`);
      delete this.transports[transport.sessionId];
      this.sessionManager.removeSessionInfo(transport.sessionId);
    };

    // DEBUG: Notify tool list changed after session creation
    this.logger.debug(
      `[MCP-DEBUG] Calling notifyToolListChanged for user: ${userInfo.email}`,
    );
    try {
      await this.sessionManager.notifyToolListChanged(userInfo.email);
      this.logger.debug(
        `[MCP-DEBUG] notifyToolListChanged completed for user: ${userInfo.email}`,
      );
    } catch (err) {
      this.logger.error(
        `[MCP-DEBUG] notifyToolListChanged failed for user: ${userInfo.email}`,
        err,
      );
    }
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
      this.logger.debug(`SSE endpoint called`);
      this.logger.debug(`Query parameters: ${JSON.stringify(req.query)}`);
      this.logger.debug(`Headers: ${JSON.stringify(req.headers)}`);

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Create a new SSE transport
      const transport = new SSEServerTransport("/messages", res);
      this.logger.info(`Transport created: ${transport.sessionId}`);

      // Create session with the transport (awaited for notification)
      await this.createSession(transport, req);

      // Connect the transport to the server
      await this.mcpServer.connect(transport);

      // Add debug logging for messages
      const originalOnMessage = transport.onmessage;
      transport.onmessage = (message: any) => {
        this.logger.debug(`SSE message for ${transport.sessionId}:`, message);
        originalOnMessage?.(message);
      };
    });

    // Message endpoint for handling MCP messages
    this.app.post("/messages", async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      this.logger.info(
        `Message for session: ${sessionId}, ${
          req?.body?.method || "no method provided"
        }`,
      );

      const transport = this.transports[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        this.logger.error(`No transport found for sessionId: ${sessionId}`);
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
      this.app.listen(this.config.server.port, () => {
        this.logger.info(
          `MCP server started on port ${this.config.server.port}`,
        );
      });
    } catch (error) {
      this.logger.error(`Failed to start MCP server: ${error}`);
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
        this.logger.info(`Notified client ${sessionId} of tool changes`);
      } catch (error) {
        this.logger.warn(
          `Failed to notify client ${sessionId} of tool changes: ${error}`,
        );
      }
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}
