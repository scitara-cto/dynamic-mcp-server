import { DlxAuthService } from "./services/DlxAuthService.js";
import { config } from "./config/index.js";
import { McpServer } from "./mcp/server.js";
import { HttpServer } from "./http/server.js";
import { createAuthMiddleware } from "./http/middleware/auth.js";
import logger from "./utils/logger.js";

// Initialize DLX Auth service
const authService = new DlxAuthService({
  authServerUrl: config.auth.authServerUrl,
  realm: config.auth.realm,
  clientId: config.auth.clientId,
  clientSecret: config.auth.clientSecret,
});

// Create MCP server
const mcpServer = new McpServer();

// Initialize MCP server (register tools)
await mcpServer.initialize();

// Create authentication middleware
const authMiddleware = createAuthMiddleware(authService);

// Create and start HTTP server
const httpServer = new HttpServer(mcpServer.getServer(), authMiddleware);
httpServer.start();

// Log application startup
logger.info(`Starting ${config.server.name} v${config.server.version}`);
logger.debug(`Environment: ${process.env.NODE_ENV || "development"}`);
logger.debug(`Log level: ${config.logging.level}`);
