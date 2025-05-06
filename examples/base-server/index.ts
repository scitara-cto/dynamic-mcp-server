import { DynamicMcpServer } from "../../src/index.js";

// Create a new MCP server instance with core functionality
const server = new DynamicMcpServer({
  name: "base-mcp-server",
  version: "1.0.0",
  port: 3000,
  host: "localhost",
});

// Start the server
server
  .start()
  .then(() => {
    console.log("Base MCP Server started with tool management");
    console.log("Available at http://localhost:3000");
  })
  .catch((error) => {
    console.error("Failed to start MCP server:", error);
  });
