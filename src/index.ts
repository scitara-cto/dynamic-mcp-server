import { AuthService } from "./http/mcp/middleware/AuthService.js";
import { config } from "./config/index.js";
import { McpServer } from "./mcp/server.js";
import { McpHttpServer } from "./http/mcp/mcp-http-server.js";
import { AuthHttpServer } from "./http/auth/auth-http-server.js";
import { createAuthMiddleware } from "./http/mcp/middleware/auth.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
const authMiddleware = createAuthMiddleware(authService);

// Create and start Auth server
const authHttpServer = new AuthHttpServer();
authHttpServer.start();

// Create HTTP server with the MCP server
const mcpHttpServer = new McpHttpServer(mcpServer, authMiddleware);

// Subscribe to tool list changes and notify clients
mcpServer.on("toolsChanged", () => {
  mcpHttpServer.notifyToolListChanged();
});

// Initialize MCP server (register tools)
await mcpServer.initialize();

// Start HTTP server
mcpHttpServer.start();

// Log application startup
logger.info(`Starting ${config.server.name} v${config.server.version}`);
