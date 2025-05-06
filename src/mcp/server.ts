import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../utils/logger.js";
import { ToolGenerator } from "./ToolGenerator.js";
import { ToolDefinition } from "./types.js";
import { EventEmitter } from "events";
import { AuthService, UserInfo } from "../http/mcp/middleware/AuthService.js";
import { McpHttpServer } from "../http/mcp/mcp-http-server.js";
import { AuthHttpServer } from "../http/auth/auth-http-server.js";
import { createAuthMiddleware } from "../http/mcp/middleware/auth.js";
import { config } from "../config/index.js";
import { ToolManagementHandler } from "../toolManagementHandler/index.js";

export interface SessionInfo {
  sessionId: string;
  user: UserInfo;
  query?: Record<string, any>;
  mcpServer?: DynamicMcpServer;
}

export interface DynamicMcpServerConfig {
  name: string;
  version: string;
  capabilities?: {
    tools?: {
      listChanged?: boolean;
    };
  };
  auth?: {
    authServerUrl?: string;
    realm?: string;
    clientId?: string;
    clientSecret?: string;
  };
  handlers?: Handler[];
}

export interface Handler {
  name: string;
  handler: (
    args: Record<string, any>,
    context: any,
    config: any,
  ) => Promise<any>;
  tools: ToolDefinition[];
}

export class DynamicMcpServer extends EventEmitter {
  private server: Server;
  public toolGenerator: ToolGenerator;
  private sessionInfo = new Map<string, SessionInfo>();
  private handlers: Handler[] = [];
  private mcpHttpServer?: McpHttpServer;
  private authHttpServer?: AuthHttpServer;

  constructor(config: DynamicMcpServerConfig) {
    super();
    this.server = new Server({
      name: config.name,
      version: config.version,
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    });
    this.toolGenerator = new ToolGenerator(this.server, this);

    // Register the tool management handler and its factory
    const toolManagementHandler = new ToolManagementHandler();
    this.registerHandler(toolManagementHandler);

    // Register any additional handlers
    if (config.handlers) {
      for (const handler of config.handlers) {
        this.registerHandler(handler);
      }
    }
  }

  /**
   * Register a new handler with the server
   */
  public registerHandler(handler: Handler): void {
    this.handlers.push(handler);
    logger.info(`Registered handler: ${handler.name}`);
    // Register the handler factory
    this.toolGenerator.registerHandlerFactory(
      handler.name,
      (config: any) => async (args: Record<string, any>, context: any) =>
        handler.handler(args, context, config),
    );
    // Register all tools for this handler
    if (handler.tools && Array.isArray(handler.tools)) {
      handler.tools.forEach((tool) => {
        this.toolGenerator.registerTool(tool);
      });
    }
  }

  /**
   * Set auth info for a session
   */
  public setSessionInfo(sessionId: string, sessionInfo: SessionInfo): void {
    sessionInfo.mcpServer = this;
    this.sessionInfo.set(sessionId, sessionInfo);
  }

  /**
   * Get auth info for a session
   */
  public getSessionInfo(sessionId: string | undefined): SessionInfo {
    if (!sessionId) {
      throw new Error("No session ID provided");
    }
    const sessionInfo = this.sessionInfo.get(sessionId);

    if (!sessionInfo) {
      logger.error(`No session context found for session ${sessionId}`);
      throw new Error(`No session context found for session ${sessionId}`);
    }

    // Set the mcpServer in the context if it exists
    sessionInfo.mcpServer = this;

    return sessionInfo;
  }

  /**
   * Remove auth info for a session
   */
  public removeSessionInfo(sessionId: string): void {
    this.sessionInfo.delete(sessionId);
  }

  /**
   * Initialize the MCP server by registering all tools from handlers
   */
  async initialize(): Promise<void> {
    try {
      // Register tools from all handlers
      for (const handler of this.handlers) {
        if (handler.tools && Array.isArray(handler.tools)) {
          for (const tool of handler.tools) {
            await this.toolGenerator.registerTool(tool);
          }
        }
      }
      // Ensure the tools/list handler is registered
      await this.toolGenerator.initialize();
    } catch (error) {
      logger.error("Failed to initialize MCP server:", error);
      throw error;
    }
  }

  /**
   * Start the MCP server with HTTP and Auth servers
   */
  async start(): Promise<void> {
    try {
      // Initialize Auth service
      const authService = new AuthService({
        authServerUrl: config.auth.authServerUrl,
        realm: config.auth.realm,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
      });

      // Create authentication middleware
      const authMiddleware = createAuthMiddleware(authService);

      // Create and start Auth server
      this.authHttpServer = new AuthHttpServer();
      this.authHttpServer.start();

      // Register the tools capability explicitly
      this.server.registerCapabilities({
        tools: {
          listChanged: true,
        },
      });

      // IMPORTANT: Pass the SDK Server instance and session manager to McpHttpServer
      this.mcpHttpServer = new McpHttpServer(this.server, this, authMiddleware);

      // Subscribe to tool list changes and notify clients
      this.on("toolsChanged", () => {
        this.mcpHttpServer?.notifyToolListChanged();
      });

      // Initialize MCP server
      await this.initialize();

      // Start HTTP server
      this.mcpHttpServer.start();

      // Log application startup
      logger.info(
        `MCP server started: ${config.server.name} v${config.server.version}`,
      );
    } catch (error) {
      logger.error("Failed to start MCP server:", error);
      throw error;
    }
  }

  /**
   * Stop the MCP server and clean up resources
   */
  async stop(): Promise<void> {
    try {
      // TODO: Implement proper cleanup
      logger.info("Stopping MCP server...");
    } catch (error) {
      logger.error("Failed to stop MCP server:", error);
      throw error;
    }
  }

  public getServer(): Server {
    return this.server;
  }
}
