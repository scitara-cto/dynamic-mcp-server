import { DynamicMcpServer, logger } from "../../src/index.js";

// Create a new MCP server instance with core functionality
const server = new DynamicMcpServer({
  name: "base-mcp-server",
  version: "1.0.0",
});

// Start the server
server
  .start()
  .then(() => {
    logger.info("Base MCP Server started with tool management");
    logger.info(
      `Available at http://localhost:${process.env.PORT || "4001"}`,
    );
  })
  .catch((error) => {
    logger.error("Failed to start MCP server:", error);
  });
