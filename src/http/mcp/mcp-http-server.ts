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

  /**
   * Creates a new session with the given transport and request
   */
  private createSession(transport: SSEServerTransport, req: Request): void {
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
      toolsAvailable: tokenData.toolsAvailable
        ? tokenData.toolsAvailable.split(",").map((t: string) => t.trim())
        : undefined,
      toolsHidden: tokenData.toolsHidden
        ? tokenData.toolsHidden.split(",").map((t: string) => t.trim())
        : undefined,
    };
    logger.debug(`Extracted user info for session: ${userInfo.sub}`);

    // Create session info with extracted user info and token
    const sessionInfo = {
      sessionId: transport.sessionId,
      user: userInfo,
      token: (req as any).token, // Store the raw token for potential future use
      mcpServer: this.sessionManager,
    };

    // Store auth info in session manager
    this.sessionManager.setSessionInfo(transport.sessionId, sessionInfo);

    // Store the transport
    this.transports[transport.sessionId] = transport;

    // Clean up when the connection closes
    transport.onclose = () => {
      logger.info(`Transport closed: ${transport.sessionId}`);
      delete this.transports[transport.sessionId];
      this.sessionManager.removeSessionInfo(transport.sessionId);
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

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Create a new SSE transport
      const transport = new SSEServerTransport("/messages", res);
      logger.info(`Transport created: ${transport.sessionId}`);

      // Create session with the transport
      this.createSession(transport, req);

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
