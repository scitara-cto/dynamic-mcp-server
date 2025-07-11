import express from "express";
import { config as realConfig } from "../config/index.js";
import realLogger from "../utils/logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../mcp/server.js";
import { createHealthRoutes } from "./routes/health.js";
import { createSSERoutes, getActiveSSETransports, getSSETransport } from "./routes/sse.js";
import { createStreamableHttpRoutes, getActiveTransports, getTransport } from "./routes/streamable-http.js";

export class HttpServer {
  private app: express.Application;
  private registeredRoutes: Set<string> = new Set();
  private mcpServer: Server;
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
      this.dynamicMcpServer
    ));

    // Modern Streamable HTTP routes
    this.app.use(createStreamableHttpRoutes(
      this.mcpServer,
      this.dynamicMcpServer
    ));
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
    // Notify all active streamable HTTP transports
    const streamableTransports = getActiveTransports();
    for (const transport of streamableTransports) {
      try {
        await transport.send({
          jsonrpc: "2.0",
          method: "notifications/tools/list_changed",
          params: {},
        });
        this.logger.debug(`[SESSION] Notified streamable HTTP client ${transport.sessionId} of tool changes`);
      } catch (error) {
        this.logger.warn(`[SESSION] Failed to notify streamable HTTP client ${transport.sessionId} of tool changes: ${error}`);
      }
    }
    
    // Notify all active SSE transports
    const sseTransports = getActiveSSETransports();
    for (const transport of sseTransports) {
      try {
        await transport.send({
          jsonrpc: "2.0",
          method: "notifications/tools/list_changed",
          params: {},
        });
        this.logger.debug(`[SESSION] Notified SSE client ${transport.sessionId} of tool changes`);
      } catch (error) {
        this.logger.warn(`[SESSION] Failed to notify SSE client ${transport.sessionId} of tool changes: ${error}`);
      }
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get transports for DynamicMcpServer - only supports /mcp and /sse endpoints
   */
  public get transports(): { [sessionId: string]: any } {
    // Create a proxy object that provides access to both streamable HTTP and SSE transports
    return new Proxy({} as { [sessionId: string]: any }, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          // First try streamable HTTP transport
          const streamableTransport = getTransport(prop);
          if (streamableTransport) {
            return streamableTransport;
          }
          // Then try SSE transport
          const sseTransport = getSSETransport(prop);
          if (sseTransport) {
            return sseTransport;
          }
        }
        return undefined;
      },
      has: (target, prop) => {
        if (typeof prop === 'string') {
          // Check streamable HTTP and SSE transports only
          return getTransport(prop) !== undefined ||
                 getSSETransport(prop) !== undefined;
        }
        return false;
      },
      ownKeys: (target) => {
        // Combine session IDs from streamable HTTP and SSE transports
        const streamableTransports = getActiveTransports();
        const streamableSessionIds = streamableTransports.map(t => t.sessionId).filter((id): id is string => Boolean(id));
        
        const sseTransports = getActiveSSETransports();
        const sseSessionIds = sseTransports.map(t => t.sessionId).filter((id): id is string => Boolean(id));
        
        return [...new Set([...streamableSessionIds, ...sseSessionIds])];
      }
    });
  }
}
