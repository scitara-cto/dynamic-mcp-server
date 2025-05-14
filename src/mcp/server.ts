import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../utils/logger.js";
import { ToolGenerator } from "./toolGenerator/ToolGenerator.js";
import { ToolDefinition } from "./types.js";
import { EventEmitter } from "events";
import { AuthService, UserInfo } from "../http/mcp/middleware/AuthService.js";
import { McpHttpServer } from "../http/mcp/mcp-http-server.js";
import { AuthHttpServer } from "../http/auth/auth-http-server.js";
import { createAuthMiddleware } from "../http/mcp/middleware/auth.js";
import { config } from "../config/index.js";
import { connectToDatabase } from "../db/connection.js";
import { UserRepository } from "../db/repositories/UserRepository.js";
import { ToolRepository } from "../db/repositories/ToolRepository.js";
import { handlers } from "../handlers/index.js";
import { syncBuiltinTools, cleanupUserToolReferences } from "../db/toolSync.js";

export interface SessionInfo {
  sessionId: string;
  user: UserInfo;
  token: string;
  mcpServer: DynamicMcpServer;
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
  private userRepository: UserRepository;
  public name: string;

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
    this.userRepository = new UserRepository();
    this.name = config.name;
    this.toolGenerator = new ToolGenerator(
      this.server,
      this,
      this.userRepository,
    );
    // Handler registration moved to initializeHandlers()
  }

  /**
   * Register all handlers from the handlers array (call after construction)
   */
  public async initializeHandlers(): Promise<void> {
    for (const handler of handlers) {
      await this.registerHandler(handler);
    }
  }

  /**
   * Register a new handler with the server and its tools
   */
  public async registerHandler(handler: Handler): Promise<void> {
    this.handlers.push(handler);
    // Register the handler factory for this handler type
    this.toolGenerator.registerHandlerFactory(
      handler.name,
      (config: any) => async (args: Record<string, any>, context: any) =>
        handler.handler(args, context, config),
    );
    logger.info(`Registered handler factory for: ${handler.name}`);

    // Register all tools defined in this handler
    if (Array.isArray(handler.tools)) {
      for (const tool of handler.tools) {
        try {
          await this.toolGenerator.publishTool(tool);
          logger.info(
            `Registered tool from handler '${handler.name}': ${tool.name}`,
          );
        } catch (err) {
          logger.error(
            `Failed to register tool '${tool.name}' from handler '${handler.name}': ${err}`,
          );
        }
      }
    }
  }

  /**
   * Set auth info for a session
   */
  public async setSessionInfo(
    sessionId: string,
    sessionInfo: SessionInfo,
  ): Promise<void> {
    sessionInfo.mcpServer = this;
    this.sessionInfo.set(sessionId, sessionInfo);
    // Load user tools for this session
    if (sessionInfo.user?.email) {
      await this.loadUserToolsForSession(sessionId, sessionInfo.user.email);
    }
  }

  /**
   * Load tools for a user and register them for the session
   */
  public async loadUserToolsForSession(
    sessionId: string,
    userEmail: string,
  ): Promise<void> {
    const user = await this.userRepository.findByEmail(userEmail);
    if (!user) {
      logger.warn(`User not found for session ${sessionId}: ${userEmail}`);
      return;
    }
    const toolRepo = new ToolRepository();
    const availableTools = await toolRepo.getAvailableToolsForUser(
      user,
      this.name,
    );
    const usedTools = user.usedTools || [];
    // Always include tools with alwaysUsed: true, plus those in usedTools
    const toolsToLoad = availableTools.filter(
      (tool) => tool.alwaysUsed || usedTools.includes(tool.name),
    );
    // Remove duplicates by tool name
    const uniqueToolsToLoad = Array.from(
      new Map(toolsToLoad.map((t) => [t.name, t])).values(),
    );
    if (!uniqueToolsToLoad.length) {
      logger.info(
        `No tools to load for session ${sessionId} (${userEmail}) (usedTools is empty or no overlap, and no alwaysUsed tools)`,
      );
      return;
    }
    for (const tool of uniqueToolsToLoad) {
      await this.toolGenerator.publishTool(tool);
    }
    logger.info(
      `Loaded ${uniqueToolsToLoad.length} tools for session ${sessionId} (${userEmail})`,
    );
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
      // Remove global tool registration from here
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
      // Connect to MongoDB
      await connectToDatabase();

      // Admin user bootstrapping
      const adminEmail = process.env.MCP_ADMIN_EMAIL;
      if (!adminEmail) {
        throw new Error(
          "[CONFIG ERROR] Admin user bootstrapping failed: MCP_ADMIN_EMAIL environment variable is not set.\n" +
            "Please set MCP_ADMIN_EMAIL in your environment or .env file.\n" +
            "Example: MCP_ADMIN_EMAIL=admin@example.com\n" +
            "The server cannot start without an admin user.",
        );
      }
      // Ensure admin user exists
      await UserRepository.ensureAdminUser(adminEmail, logger);

      // --- Tool sync and user tool cleanup ---
      const removedToolNames = await syncBuiltinTools();
      await cleanupUserToolReferences(removedToolNames);

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

  /**
   * Notify all sessions, or only sessions for a given user email, of tool list changes
   */
  public async notifyToolListChanged(userEmail?: string): Promise<void> {
    if (userEmail) {
      for (const [sessionId, sessionInfo] of this.sessionInfo.entries()) {
        if (sessionInfo.user?.email === userEmail) {
          this.emit("toolsChanged", sessionId);
        }
      }
    } else {
      this.emit("toolsChanged");
    }
  }

  public getAuthHttpServer(): AuthHttpServer | undefined {
    return this.authHttpServer;
  }
}
