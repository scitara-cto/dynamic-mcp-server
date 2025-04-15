import { AuthService } from "./http/auth/AuthService.js";
import { config } from "./config/index.js";
import { McpServer } from "./mcp/server.js";
import { HttpServer } from "./http/mcp/mcp-server.js";
import { AuthServer } from "./http/auth/auth-server.js";
import { createAuthMiddleware } from "./http/mcp/middleware/auth.js";
import logger from "./utils/logger.js";

// Initialize DLX Auth service
const authService = new AuthService({
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

// Create and start Auth server
const authServer = new AuthServer();
authServer.start();

// Create and start MCP server
const httpServer = new HttpServer(mcpServer.getServer(), authMiddleware);
httpServer.start();

// Log application startup
logger.info(`Starting ${config.server.name} v${config.server.version}`);
logger.info(`Auth server running on port ${config.auth.port}`);
logger.info(`MCP server running on port ${config.server.port}`);
