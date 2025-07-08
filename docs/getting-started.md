# Getting Started

## Installation

```bash
npm install dynamic-mcp-server
```

## Basic Server Setup

Create a basic MCP server with tool management:

```typescript
import { DynamicMcpServer } from "dynamic-mcp-server";

const server = new DynamicMcpServer({
  name: "my-mcp-server",
  version: "1.0.0",
});

server.start().then(() => {
  console.log("MCP server started");
});
```

See the [Examples](./examples.md) for more advanced usage.

For more details on server instantiation and configuration options, see the [API Reference](./api-reference.md).

## Authentication (API Key)

- Each user is assigned a unique `apiKey` when created (including the admin user).
- To connect, clients must provide the `apiKey` via query parameter OR header:
  - **Query Parameter**: `?apiKey=your-key` or `?apikey=your-key`
  - **Header**: `x-apikey: your-key` or `apikey: your-key`
- **SSE Transport (Legacy)**: `/sse?apiKey=...` or `/sse` with header
- **Streamable HTTP Transport (Modern)**: `/mcp?apiKey=...` or `/mcp` with header
- The server authenticates users by looking up the `apiKey` in the database.
- **Admins can view all user apiKeys in the server logs** when users connect, or at startup for the admin user.
- No OAuth or external identity provider is required.

## Transport Protocols

The server supports both modern and legacy MCP transport protocols:

### Streamable HTTP Transport (Recommended)
- **Endpoint**: `/mcp`
- **Protocol Version**: 2025-03-26
- **Features**: Single endpoint, efficient communication
- **Best for**: New integrations and modern MCP clients

### SSE Transport (Legacy Support)
- **Endpoints**: `/sse` (connection) + `/messages` (communication)
- **Protocol Version**: 2024-11-05
- **Features**: Server-Sent Events based communication
- **Best for**: Existing integrations requiring backwards compatibility

Both transports share the same authentication system and provide identical functionality.

## Registering Tools via Handler Packages

The recommended way to add tools is to group them in a handler package and register the package with the server:

```js
const myHandlerPackage = {
  name: "my-domain",
  tools: [
    {
      name: "my-tool",
      description: "A custom tool",
      inputSchema: {
        /* ... */
      },
      handler: { type: "my-domain", config: {} },
      rolesPermitted: ["user", "admin"],
    },
  ],
  handler: async (args, context, config, toolName) => {
    // Tool logic here
  },
};

await server.registerHandler(myHandlerPackage);
```

See the [Examples](./examples.md) for more advanced usage and patterns.

## Connecting from Cursor (or other MCP clients)

To connect Cursor (or any MCP client that supports HTTP/SSE) to this server using an API key:

1. **Find your API key:**

   - The admin user's apiKey is logged to the console at server startup.
   - For other users, use the `add-user` tool or check the logs when they connect.

2. **Edit your `~/.cursor/mcp.json` file** to add your server with the apiKey as a query parameter:

   ```json
   {
     "mcpServers": {
       "my-mcp-server": {
         "url": "http://localhost:4001/sse?apiKey=YOUR_API_KEY"
       }
     }
   }
   ```

3. **Restart Cursor** and select your server from the MCP server list.

> **Note:** Cursor does not currently support sending custom headers for SSE connections, so the apiKey must be included as a query parameter in the URL.

## Omitting Handlers at Startup

In some advanced scenarios, you may want to prevent the server from loading certain built-in handlers. This can be useful if you are running multiple MCP servers that share a common client and you want to avoid duplicate tool registrations.

You can control which handlers are loaded by setting the `OMIT_HANDLERS` environment variable. This variable accepts a comma-separated list of handler names to omit.

**Examples:**

*   To omit the `user-management` handler:
    ```
    OMIT_HANDLERS="user-management"
    ```

*   To omit both the `tool-management` and `prompt-management` handlers:
    ```
    OMIT_HANDLERS="tool-management,prompt-management"
    ```

*   To omit all built-in "native" handlers, you can use the special `native` keyword:
    ```
    OMIT_HANDLERS="native"
    ```

*   You can also combine the `native` keyword with other handler names:
    ```
    OMIT_HANDLERS="native,my-custom-handler"
    ```
