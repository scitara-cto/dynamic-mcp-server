import express from "express";
import { config as realConfig } from "../config/index.js";
import realLogger from "../utils/logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../mcp/server.js";
import { SessionManager } from "./services/session-manager.js";
import { createHealthRoutes } from "./routes/health.js";
import { createSSERoutes } from "./routes/sse.js";
import { createStreamableHttpRoutes } from "./routes/streamable-http.js";

export class HttpServer {
  private app: express.Application;
  private registeredRoutes: Set<string> = new Set();
  private mcpServer: Server;
  private sessionManager: SessionManager;
  private dynamicMcpServer: DynamicMcpServer;
  private config: typeof realConfig;
  private logger: typeof realLogger;

  constructor(
    mcpServer: Server,
    dynamicMcpServer: DynamicMcpServer,
    config = realConfig,
    logger = realLogger,
  ) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.dynamicMcpServer = dynamicMcpServer;
    this.sessionManager = new SessionManager(dynamicMcpServer);
    this.config = config;
    this.logger = logger;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check routes
    this.app.use(createHealthRoutes());


    // Legacy SSE routes
    this.app.use(createSSERoutes(
      this.mcpServer,
      this.sessionManager,
      this.dynamicMcpServer
    ));

    // Modern Streamable HTTP routes
    this.app.use(createStreamableHttpRoutes(
      this.mcpServer,
      this.sessionManager,
      this.dynamicMcpServer
    ));

    // Session monitoring endpoint for debugging
    this.app.get('/debug/sessions', (req, res) => {
      try {
        const stats = this.sessionManager.getSessionStats();
        res.json({
          timestamp: new Date().toISOString(),
          ...stats
        });
      } catch (error) {
        this.logger.error(`Error getting session stats: ${error}`);
        res.status(500).json({ error: 'Failed to get session stats' });
      }
    });

    this.logger.info("All HTTP routes configured");
  }

  public start(): void {
    try {
      this.app.listen(this.config.server.port, () => {
        this.logger.info(
          `MCP server started on port ${this.config.server.port}`,
        );
        this.logger.info("Available endpoints:");
        this.logger.info("  - Health: GET /status, GET /health");
        this.logger.info("  - Legacy SSE: GET /sse, POST /messages");
        this.logger.info("  - Streamable HTTP: ALL /mcp");
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
    await this.sessionManager.notifyAllSessions();
  }

  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get session manager for accessing transports (used by DynamicMcpServer)
   */
  public getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Get transports for backward compatibility (used by DynamicMcpServer)
   */
  public get transports(): { [sessionId: string]: any } {
    // Create a proxy object that provides access to transports via session manager
    return new Proxy({} as { [sessionId: string]: any }, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          return this.sessionManager.getTransport(prop);
        }
        return undefined;
      },
      has: (target, prop) => {
        if (typeof prop === 'string') {
          return this.sessionManager.getTransport(prop) !== undefined;
        }
        return false;
      },
      ownKeys: (target) => {
        return this.sessionManager.getActiveSessions();
      }
    });
  }
}
