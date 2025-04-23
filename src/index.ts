import { AuthService } from "./http/auth/AuthService.js";
import { config } from "./config/index.js";
import { McpServer } from "./mcp/server.js";
import { HttpServer } from "./http/mcp/mcp-server.js";
import { AuthServer } from "./http/auth/auth-server.js";
import { createAuthMiddleware } from "./http/mcp/middleware/auth.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DlxService } from "./services/DlxService.js";
import logger from "./utils/logger.js";

// Initialize DLX Auth service
const authService = new AuthService({
  authServerUrl: config.auth.authServerUrl,
  realm: config.auth.realm,
  clientId: config.auth.clientId,
  clientSecret: config.auth.clientSecret,
});

// Create the MCP Server instance directly
const mcpServerInstance = new Server({
  name: config.server.name,
  version: config.server.version,
  capabilities: {
    tools: {
      listChanged: true,
    },
  },
});

// Register the tools capability explicitly
mcpServerInstance.registerCapabilities({
  tools: {
    listChanged: true,
  },
});

// Create MCP server
const mcpServer = new McpServer(mcpServerInstance);

// Create authentication middleware
const authMiddleware = createAuthMiddleware(authService, mcpServer);

// Create and start Auth server
const authServer = new AuthServer();
authServer.start();

// Create DLX service
const dlxService = new DlxService();

// Create HTTP server with the MCP server
const httpServer = new HttpServer(mcpServer, authMiddleware, dlxService);

// Initialize MCP server (register tools)
await mcpServer.initialize();

// Start HTTP server
httpServer.start();

// Log application startup
logger.info(`Starting ${config.server.name} v${config.server.version}`);
