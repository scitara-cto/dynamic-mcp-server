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
import { ToolManagementHandler } from "../handlers/toolManagementHandler/index.js";
import { UserManagementHandler } from "../handlers/userManagementHandler/index.js";
import { connectToDatabase } from "../db/connection.js";
import { UserRepository } from "../db/repositories/UserRepository.js";
import { ToolRepository } from "../db/repositories/ToolRepository.js";
import { toolManagementTools } from "../handlers/toolManagementHandler/tools.js";
import { userManagementTools } from "../handlers/userManagementHandler/tools.js";

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
    this.toolGenerator = new ToolGenerator(
      this.server,
      this,
      this.userRepository,
    );

    // Register the tool management handler and its factory
    const toolManagementHandler = new ToolManagementHandler();
    this.registerHandler(toolManagementHandler);

    // Register the user management handler and its factory
    const userManagementHandler = new UserManagementHandler();
    this.registerHandler(userManagementHandler);

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
    const allowed = user.allowedTools || [];
    const shared = (user.sharedTools || []).map((t: any) => t.toolId);
    const toolNames = Array.from(new Set([...allowed, ...shared]));
    if (!toolNames.length) return;
    const toolRepo = new ToolRepository();
    const tools = await toolRepo.findByNames(toolNames);
    for (const tool of tools) {
      await this.toolGenerator.publishTool(tool as any); // ToolDefinition compatible
    }
    logger.info(
      `Loaded ${tools.length} tools for session ${sessionId} (${userEmail})`,
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
   * Synchronize built-in tools: upsert current, remove stale, and return removed tool names
   */
  private async syncBuiltinTools(): Promise<string[]> {
    const toolRepo = new ToolRepository();
    const builtinTools = [...toolManagementTools, ...userManagementTools].map(
      (tool) => ({
        ...tool,
        creator: "system",
      }),
    );
    await toolRepo.upsertMany(builtinTools);
    logger.info("Bootstrapped built-in tools into the tools collection");

    // Remove stale built-in tools
    const builtinToolNames = new Set(builtinTools.map((t) => t.name));
    const dbBuiltinTools = await toolRepo.list({});
    const removedToolNames: string[] = [];
    for (const tool of dbBuiltinTools) {
      if (tool.creator === "system" && !builtinToolNames.has(tool.name)) {
        await toolRepo.deleteTool(tool.name);
        removedToolNames.push(tool.name);
        logger.info(`Removed stale built-in tool from DB: ${tool.name}`);
      }
    }
    return removedToolNames;
  }

  /**
   * Remove references to removed tools from all users' allowedTools and sharedTools
   */
  private async cleanupUserToolReferences(
    removedToolNames: string[],
  ): Promise<void> {
    if (!removedToolNames.length) return;
    const userRepo = new UserRepository();
    const users = await userRepo.list({ skip: 0, limit: 10000 }); // adjust limit as needed
    for (const user of users) {
      let changed = false;
      if (user.allowedTools) {
        const filtered = user.allowedTools.filter(
          (name) => !removedToolNames.includes(name),
        );
        if (filtered.length !== user.allowedTools.length) {
          user.allowedTools = filtered;
          changed = true;
        }
      }
      if (user.sharedTools) {
        const filtered = user.sharedTools.filter(
          (st) => !removedToolNames.includes(st.toolId),
        );
        if (filtered.length !== user.sharedTools.length) {
          user.sharedTools = filtered;
          changed = true;
        }
      }
      if (changed) {
        await userRepo.updateUser(user.email, {
          allowedTools: user.allowedTools,
          sharedTools: user.sharedTools,
        });
        logger.info(`Cleaned up stale tool references for user: ${user.email}`);
      }
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

      // --- Tool sync and user tool cleanup ---
      const removedToolNames = await this.syncBuiltinTools();
      await this.cleanupUserToolReferences(removedToolNames);

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
