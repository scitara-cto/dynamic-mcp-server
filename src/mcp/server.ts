import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../utils/logger.js";
import { ToolService } from "../services/ToolService.js";
import { PromptService } from "../services/PromptService.js";
import { HandlerFunction, HandlerPackage } from "./types.js";
import { EventEmitter } from "events";
import { HttpServer } from "../http/http-server.js";
import { config } from "../config/index.js";
import { connectToDatabase } from "../db/connection.js";
import { UserRepository } from "../db/repositories/UserRepository.js";
import { handlerPackages } from "../handlers/index.js";
import { ToolRepository } from "../db/repositories/ToolRepository.js";
import { PromptRepository } from "../db/repositories/PromptRepository.js";

export interface SessionInfo {
  sessionId: string;
  user: any;
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
  handlers?: HandlerFunction[];
}

export class DynamicMcpServer extends EventEmitter {
  private server: Server;
  public toolService: ToolService;
  public promptService: PromptService;
  private sessionInfo = new Map<string, SessionInfo>();
  private handlers: Map<string, HandlerFunction> = new Map();
  private httpServer?: HttpServer;
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
        prompts: {
          listChanged: true,
        },
      },
    });
    this.userRepository = new UserRepository();
    this.name = config.name;
    this.toolService = new ToolService(this.server, this, this.userRepository);
    this.promptService = new PromptService(this.server, this, this.userRepository);
    // Handler registration moved to initializeHandlers() or start()
  }

  /**
   * Register a handler package (from core or downstream app).
   * handlerPackage: { name: string, handler: HandlerFunction, tools: ToolDefinition[], prompts?: PromptDefinition[] }
   */
  public async registerHandler(handlerPackage: HandlerPackage): Promise<void> {
    this.handlers.set(handlerPackage.name, handlerPackage.handler);
    
    // Register tools in DB
    let toolNames: string[] = [];
    if (Array.isArray(handlerPackage.tools)) {
      for (const tool of handlerPackage.tools) {
        await this.toolService.addTool(tool, handlerPackage.name);
        if (tool && tool.name) {
          toolNames.push(tool.name);
        }
      }
    }
    
    // Register prompts in DB
    let promptNames: string[] = [];
    if (Array.isArray(handlerPackage.prompts)) {
      for (const prompt of handlerPackage.prompts) {
        await this.promptService.addPrompt(prompt, this.name);
        if (prompt && prompt.name) {
          promptNames.push(prompt.name);
        }
      }
    }
    
    const toolList = toolNames.length > 0 ? ` (tools: ${toolNames.join(", ")})` : "";
    const promptList = promptNames.length > 0 ? ` (prompts: ${promptNames.join(", ")})` : "";
    logger.info(`Registered handler for: ${handlerPackage.name}${toolList}${promptList}`);

    // If the handler has an init method, call it
    if (handlerPackage.init) {
      await handlerPackage.init();
    }

    // If the handler has auth routes, register them
    if (this.httpServer && Array.isArray(handlerPackage.authRoutes)) {
      for (const route of handlerPackage.authRoutes) {
        this.httpServer.addHttpRoute(route.method, route.path, route.handler);
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
    // No longer need to load user tools for the session; DB-backed approach is used
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
   * Initialize the MCP server by registering all tools and prompts from handlers
   */
  async initialize(): Promise<void> {
    try {
      // Initialize tool and prompt services
      await this.toolService.initialize();
      await this.promptService.initialize();
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

      // --- Tool and Prompt reset ---
      const toolRepo = new ToolRepository();
      await toolRepo.resetSystemTools();
      
      const promptRepo = new PromptRepository();
      await promptRepo.resetSystemPrompts();

      // Register built-in handlers after reset
      for (const handlerPackage of handlerPackages) {
        if (!this.handlers.has(handlerPackage.name)) {
          await this.registerHandler(handlerPackage);
        }
      }

      // Register the tools and prompts capabilities explicitly
      this.server.registerCapabilities({
        tools: {
          listChanged: true,
        },
        prompts: {
          listChanged: true,
        },
      });

      // IMPORTANT: Pass the SDK Server instance and session manager to McpHttpServer
      this.httpServer = new HttpServer(this.server, this, config, logger);

      // Subscribe to tool list changes and notify clients
      this.on("toolsChanged", () => {
        this.httpServer?.notifyToolListChanged();
      });

      // Initialize MCP server
      await this.initialize();

      // Start HTTP server
      this.httpServer.start();

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
   * Send a JSON-RPC notification to a specific session by sessionId
   */
  public async sendNotificationToSession(
    sessionId: string,
    notification: { method: string; params?: any },
  ): Promise<void> {
    if (!this.httpServer) {
      logger.warn("No httpServer instance available for sending notifications");
      return;
    }
    // @ts-ignore: access private transports property
    const transports = this.httpServer.transports;
    const transport = transports[sessionId];
    if (transport) {
      try {
        await transport.send({
          jsonrpc: "2.0",
          ...notification,
        });
      } catch (error) {
        logger.error(
          `[MCP] Failed to send notification to session ${sessionId}: ${error}`,
        );
      }
      logger.info(
        `[MCP] Sent notification to session ${sessionId}: ${notification.method}`,
      );
    }
  }

  /**
   * Notify all sessions, or only sessions for a given user email, of tool list changes
   */
  public async notifyToolListChanged(userEmail?: string): Promise<void> {
    logger.debug(
      `[MCP] notifyToolListChanged called for userEmail=${userEmail}`,
    );
    if (!this.httpServer) {
      logger.warn("No httpServer instance available for sending notifications");
      return;
    }
    // @ts-ignore: access private transports property
    const transports = this.httpServer.transports;
    if (userEmail) {
      for (const [sessionId, sessionInfo] of this.sessionInfo.entries()) {
        if (sessionInfo.user?.email === userEmail) {
          logger.debug(
            `[MCP] Notifying session ${sessionId} for user ${userEmail}`,
          );
          await this.sendNotificationToSession(sessionId, {
            method: "notifications/tools/list_changed",
            params: {},
          });
        }
      }
    } else {
      for (const sessionId in transports) {
        logger.debug(`[MCP] Notifying session ${sessionId} (all users)`);
        await this.sendNotificationToSession(sessionId, {
          method: "notifications/tools/list_changed",
          params: {},
        });
      }
    }
  }

  /**
   * Notify all sessions, or only sessions for a given user email, of prompt list changes
   */
  public async notifyPromptListChanged(userEmail?: string): Promise<void> {
    logger.debug(
      `[MCP] notifyPromptListChanged called for userEmail=${userEmail}`,
    );
    if (!this.httpServer) {
      logger.warn("No httpServer instance available for sending notifications");
      return;
    }
    // @ts-ignore: access private transports property
    const transports = this.httpServer.transports;
    if (userEmail) {
      for (const [sessionId, sessionInfo] of this.sessionInfo.entries()) {
        if (sessionInfo.user?.email === userEmail) {
          logger.debug(
            `[MCP] Notifying session ${sessionId} for user ${userEmail}`,
          );
          await this.sendNotificationToSession(sessionId, {
            method: "notifications/prompts/list_changed",
            params: {},
          });
        }
      }
    } else {
      for (const sessionId in transports) {
        logger.debug(`[MCP] Notifying session ${sessionId} (all users)`);
        await this.sendNotificationToSession(sessionId, {
          method: "notifications/prompts/list_changed",
          params: {},
        });
      }
    }
  }

  public getHttpServer(): HttpServer | undefined {
    return this.httpServer;
  }

  /**
   * Get a handler by name (for tool execution)
   */
  public getHandler(name: string): HandlerFunction | undefined {
    return this.handlers.get(name);
  }
}
