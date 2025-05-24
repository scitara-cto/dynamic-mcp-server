import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config as realConfig } from "../config/index.js";
import realLogger from "../utils/logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../mcp/server.js";
import { UserRepository } from "../db/repositories/UserRepository.js";

export class HttpServer {
  private app: express.Application;
  private registeredRoutes: Set<string> = new Set();
  private mcpServer: Server;
  private sessionManager: DynamicMcpServer;
  private transports: { [sessionId: string]: SSEServerTransport } = {};
  private config: typeof realConfig;
  private logger: typeof realLogger;

  constructor(
    mcpServer: Server,
    sessionManager: DynamicMcpServer,
    config = realConfig,
    logger = realLogger,
  ) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.sessionManager = sessionManager;
    this.config = config;
    this.logger = logger;
    this.setupHealthCheck();
    this.setupMcpRoutes();
  }

  /**
   * Creates a new session with the given transport and request
   */
  private async createSession(
    transport: SSEServerTransport,
    req: Request,
  ): Promise<void> {
    // Use user info from API key auth logic
    const userInfo = (req as any).user;
    if (!userInfo) {
      this.logger.warn("No user info found in request during session creation");
      return;
    }
    this.logger.debug(`Extracted user info for session: ${userInfo.email}`);

    // Create session info with user
    const sessionInfo = {
      sessionId: transport.sessionId,
      user: userInfo,
      token: userInfo.apiKey,
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
    // (Moved to /sse handler after connect)
  }

  private setupHealthCheck(): void {
    // Health check endpoint
    this.app.get("/status", (_req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });
    this.logger.info("Health check endpoint setup as /status");
  }

  private setupMcpRoutes(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // SSE endpoint with inline API key authentication
    this.app.get("/sse", async (req: Request, res: Response) => {
      // Debug: Log query and headers
      this.logger.info(
        `[DEBUG] /sse called. Query: ${JSON.stringify(
          req.query,
        )}, Headers: ${JSON.stringify(req.headers)}`,
      );
      // API key authentication logic
      const apiKey =
        req.query.apiKey ||
        req.query.apikey ||
        req.headers["x-apikey"] ||
        req.headers["apikey"];
      if (!apiKey) {
        res.status(401).json({ error: "Missing apiKey" });
        return;
      }
      const userRepo = new UserRepository();
      const user = await userRepo.findByApiKey(apiKey as string);
      if (!user) {
        this.logger.warn(
          `Invalid apiKey attempt: apiKey=${apiKey}, ip=${req.ip}`,
        );
        res.status(401).json({
          error:
            "Invalid apiKey. Please contact the administrator to request access or a valid API key.",
        });
        return;
      }
      (req as any).user = user;

      // Log authenticated user and apiKey for admin visibility
      this.logger.info(
        `[AUTH] User authenticated: email=${user.email}, apiKey=${user.apiKey}`,
      );

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

      // Create session with the transport (no notification yet)
      await this.createSession(transport, req);

      // Also clean up on HTTP response close
      res.on("close", () => {
        this.logger.info(
          `HTTP response closed for session: ${transport.sessionId}`,
        );
        delete this.transports[transport.sessionId];
        this.sessionManager.removeSessionInfo(transport.sessionId);
        clearInterval(heartbeatInterval);
      });

      // Heartbeat/keepalive to prevent connection timeout
      const heartbeatInterval = setInterval(() => {
        res.write(": keepalive\n\n");
        if (typeof (res as any).flush === "function") {
          (res as any).flush();
        }
      }, 25000); // every 25 seconds

      // Connect the transport to the server
      await this.mcpServer.connect(transport);

      // Now notify tool list changed (after connection is ready)
      await this.sessionManager.notifyToolListChanged(user.email);

      // Add debug logging for messages
      const originalOnMessage = transport.onmessage;
      transport.onmessage = (message: any) => {
        this.logger.debug(`SSE message for ${transport.sessionId}:`, message);
        originalOnMessage?.(message);
      };
    });

    // Message endpoint for handling MCP messages (no auth middleware)
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

    // Debug endpoint to list active sessions (no auth middleware)
    this.app.get("/sessions", (_req: Request, res: Response) => {
      res.json({
        activeSessions: Object.keys(this.transports),
        count: Object.keys(this.transports).length,
      });
    });

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

  /**
   * Add a new HTTP route to the server, ensuring no overwrite of existing routes.
   * Throws an error if the route already exists for the given method.
   */
  public addHttpRoute(
    method: "get" | "post" | "put" | "delete" | "patch",
    path: string,
    handler: express.RequestHandler,
  ): void {
    const routeKey = `${method.toLowerCase()} ${path}`;
    if (this.registeredRoutes.has(routeKey)) {
      throw new Error(
        `Route already exists: [${method.toUpperCase()}] ${path}`,
      );
    }
    (this.app as any)[method](path, handler);
    this.registeredRoutes.add(routeKey);
    this.logger.info(`Added custom route: [${method.toUpperCase()}] ${path}`);
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
