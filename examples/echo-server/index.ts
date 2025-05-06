import { DynamicMcpServer } from "../../src/index.js";

const echoHandler = {
  name: "echo",
  tools: [
    {
      name: "echo",
      description: "Echo back the input message",
      inputSchema: {
        type: "object" as const,
        properties: {
          message: { type: "string", description: "Message to echo back" },
        },
      },
      annotations: {
        title: "Echo",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      handler: {
        type: "echo",
        config: {
          action: "echo",
        },
      },
    },
  ],
  handler: async (args: Record<string, any>) => {
    return {
      result: {
        message: args.message,
      },
      message: "Message echoed successfully",
    };
  },
};

// Create MCP server with echo handler
const server = new DynamicMcpServer({
  name: "echo-mcp-server",
  version: "1.0.0",
  port: 3000,
  host: "localhost",
});

server.registerHandler(echoHandler);

// Start the server
server
  .start()
  .then(() => {
    console.log("Echo MCP Server started with echo handler");
    console.log("Available at http://localhost:3000");
  })
  .catch((error) => {
    console.error("Failed to start MCP server:", error);
  });
