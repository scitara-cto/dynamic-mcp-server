import express, { Request, Response, RequestHandler } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config as realConfig } from "../config/index.js";
import realLogger from "../utils/logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../mcp/server.js";
import { handleClientRegistration } from "./client-registration.js";
import { handleOAuthMetadata } from "./oauth-metadata.js";
import {
  handleProtectedResourceMetadata,
  handleAuthorizationServerMetadata,
} from "./discovery.js";
import axios from "axios";

export class HttpServer {
  private app: express.Application;
  private mcpServer: Server;
  private sessionManager: DynamicMcpServer;
  private authMiddleware: RequestHandler;
  private transports: { [sessionId: string]: SSEServerTransport } = {};
  private config: typeof realConfig;
  private logger: typeof realLogger;
  private registeredRoutes: Set<string> = new Set();

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

  private async createSession(
    transport: SSEServerTransport,
    req: Request,
  ): Promise<void> {
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

    let enrichedUser = null;
    try {
      const { UserRepository } = await import(
        "../db/repositories/UserRepository.js"
      );
      const userRepo = new UserRepository();
      const dbUser = await userRepo.findByEmail(userInfo.email);
      if (dbUser) {
        enrichedUser = { ...dbUser, claims: userInfo };
      } else {
        this.logger.warn(`User not found in DB for session: ${userInfo.email}`);
        enrichedUser = { ...userInfo, claims: userInfo };
      }
    } catch (err) {
      this.logger.error(`Error fetching user from DB: ${err}`);
      enrichedUser = { ...userInfo, claims: userInfo };
    }

    const sessionInfo = {
      sessionId: transport.sessionId,
      user: enrichedUser,
      token: (req as any).token,
      mcpServer: this.sessionManager,
    };
    this.sessionManager.setSessionInfo(transport.sessionId, sessionInfo);
    this.transports[transport.sessionId] = transport;
    transport.onclose = () => {
      this.logger.info(`Transport closed: ${transport.sessionId}`);
      delete this.transports[transport.sessionId];
      this.sessionManager.removeSessionInfo(transport.sessionId);
    };
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

    // --- Auth endpoints ---
    this.app.get(
      "/.well-known/oauth-protected-resource",
      handleProtectedResourceMetadata,
    );
    this.app.get(
      "/.well-known/oauth-authorization-server",
      handleAuthorizationServerMetadata,
    );
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });
    // OAuth callback endpoint
    this.app.get("/callback", async (req, res) => {
      const { code, state } = req.query;
      if (state !== "random-state-value") {
        res.status(400).send("Invalid state parameter");
        return;
      }
      try {
        const tokenUrl = `${this.config.auth.authServerUrl}/realms/${this.config.auth.realm}/protocol/openid-connect/token`;
        const formData = new URLSearchParams();
        formData.append("grant_type", "authorization_code");
        formData.append("client_id", this.config.auth.clientId);
        formData.append("client_secret", this.config.auth.clientSecret);
        formData.append("code", code as string);
        formData.append("redirect_uri", this.config.auth.redirectUri);
        const response = await axios.post(tokenUrl, formData, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        const { access_token, refresh_token } = response.data;
        res.send(`
          <h1>Authorization Successful!</h1>
          <p>Access Token: ${access_token}</p>
          <p>Refresh Token: ${refresh_token}</p>
        `);
      } catch (error: any) {
        this.logger.error(
          "Error exchanging code for token:",
          error.response?.data || error.message,
        );
        res.status(500).send("Error exchanging code for token");
      }
    });

    // --- MCP endpoints ---
    this.app.use("/sse", this.authMiddleware);
    this.app.use("/messages", this.authMiddleware);
    this.app.get(
      "/.well-known/oauth-authorization-server",
      handleOAuthMetadata,
    );
    this.app.get("/.well-known/openid-configuration", handleOAuthMetadata);
    this.app.post("/register", handleClientRegistration);
    this.app.get("/sse", async (req: Request, res: Response) => {
      this.logger.debug(`SSE endpoint called`);
      this.logger.debug(`Query parameters: ${JSON.stringify(req.query)}`);
      this.logger.debug(`Headers: ${JSON.stringify(req.headers)}`);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const transport = new SSEServerTransport("/messages", res);
      this.logger.info(`Transport created: ${transport.sessionId}`);
      await this.createSession(transport, req);
      await this.mcpServer.connect(transport);
      const originalOnMessage = transport.onmessage;
      transport.onmessage = (message: any) => {
        this.logger.debug(`SSE message for ${transport.sessionId}:`, message);
        originalOnMessage?.(message);
      };
    });
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
  }

  public start(): void {
    const port = this.config.server.port || this.config.auth.port || 3000;
    try {
      this.app.listen(port, () => {
        this.logger.info(`HTTP server started on port ${port}`);
      });
    } catch (error) {
      this.logger.error(`Failed to start HTTP server: ${error}`);
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

  public addHttpRoute(
    method: "get" | "post" | "put" | "delete" | "patch",
    path: string,
    handler: express.RequestHandler,
  ): void {
    // Ensure all custom routes are under /custom
    let customPath = path.startsWith("/custom")
      ? path
      : `/custom${path.startsWith("/") ? "" : "/"}${path}`;
    const routeKey = `${method.toLowerCase()} ${customPath}`;
    if (this.registeredRoutes.has(routeKey)) {
      throw new Error(
        `Route already exists: [${method.toUpperCase()}] ${customPath}`,
      );
    }
    (this.app as any)[method](customPath, handler);
    this.registeredRoutes.add(routeKey);
    this.logger.info(
      `Added custom route: [${method.toUpperCase()}] ${customPath}`,
    );
  }

  public getApp(): express.Application {
    return this.app;
  }
}
