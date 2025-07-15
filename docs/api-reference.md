# API Reference

## Authentication (API Key)

- All users (including admin) are assigned a unique `apiKey` for authentication.
- Clients must provide the `apiKey` via query parameter OR header when connecting:
  - **Query Parameter**: `?apiKey=your-key` or `?apikey=your-key`
  - **Header**: `x-apikey: your-key` or `apikey: your-key`
- **Streamable HTTP Transport**: `/mcp?apiKey=...` or `/mcp` with header
- The server authenticates users by looking up the `apiKey` in the database.
- **Admins can view all user apiKeys in the server logs** when users connect, or at startup for the admin user.
- No OAuth or external identity provider is required.

## Transport Protocols

### Streamable HTTP Transport
- **Protocol Version**: 2025-03-26
- **Endpoint**: `/mcp`
- **Methods**: GET (capabilities), POST (requests), DELETE (cleanup)
- **Authentication**: Query parameter `?apiKey=your-key` OR header `x-apikey: your-key`
- **Session Management**: Automatic session creation and cleanup
- **Features**: Single endpoint, efficient, modern MCP standard

The streamable HTTP transport provides full tool execution and user management capabilities.

## Tool Access & Visibility Model

- A user can access a tool if:
  - Their roles overlap with the tool's `rolesPermitted` array, OR
  - The tool is in their `sharedTools`, OR
  - They are the creator, OR
  - The tool is a built-in system tool.
- The set of tools a user can access is called their **available tools** (computed dynamically).
- **All tools are visible to users by default.**
- Users can "hide" any tool from their available tools list. The set of tools a user has chosen to hide is stored in the `hiddenTools` array on their user record.
- The `hiddenTools` array is for personalization/filtering only. **It does not grant or restrict access to tools.**
- The `list-tools` action returns all tools, with `available` and `hidden` flags for each tool:
  - `available`: User is permitted to use this tool.
  - `hidden`: Tool is in the user's `hiddenTools` array.
- To hide a tool, use the `hide-tool` action.
- To unhide a tool, use the `unhide-tool` action.

See [User Management](./user-management.md) and [Tool Management](./tool-management.md) for more details.

## DynamicMcpServer

The main server class that handles tool registration, user management, and session handling.

```typescript
interface DynamicMcpServerConfig {
  name: string;
  version: string;
  port?: number;
  host?: string;
}

interface HandlerPackage {
  name: string;
  tools: ToolDefinition[];
  handler: (
    args: Record<string, any>,
    context: any,
    config: any,
    toolName?: string,
  ) => Promise<any>;
}

class DynamicMcpServer {
  constructor(config: DynamicMcpServerConfig);
  start(): Promise<void>;
  registerHandler(handlerPackage: HandlerPackage): Promise<void>;
}
```

**Registering Tools via Handler Packages:**

```js
const myHandlerPackage = {
  name: "my-domain",
  tools: [
    /* ... */
  ],
  handler: async (args, context, config, toolName) => {
    /* ... */
  },
};
await server.registerHandler(myHandlerPackage);
```

## addHttpRoute

Add a custom HTTP route to the Auth server:

```typescript
addHttpRoute(
  serverInstance: DynamicMcpServer,
  method: "get" | "post",
  path: string,
  handler: import("express").RequestHandler
): void;
```

## Email Utilities

The following functions are exported for sending email from downstream handlers or custom code:

### sendEmail

Send a single email to a recipient.

```typescript
import { sendEmail } from "dynamic-mcp-server";

await sendEmail({
  to: string, // Recipient email address
  subject: string, // Email subject
  html: string, // HTML body of the email
});
```

- Returns a promise that resolves to a result object with a `message` property and Postmark API response fields.
- If the email service is not configured, logs an error and returns a message.

### sendBulkEmail

Send a bulk email to multiple recipients (BCC), with a copy to the sender.

```typescript
import { sendBulkEmail } from "dynamic-mcp-server";

await sendBulkEmail({
  toList: string[],   // Array of recipient email addresses
  subject: string,    // Email subject
  html: string        // HTML body of the email
});
```

- Sends the email as BCC to all recipients, and a copy to the sender.
- Returns a promise that resolves to a result object with a `message` property and Postmark API response fields.
- If the email service is not configured, logs an error and returns a message.

## Logger

The library exports a preconfigured Winston logger instance for use in your application, handlers, or custom routes.

- Supports log levels: `error`, `warn`, `info`, `http`, `debug` (configurable via environment/config).
- Logs to the console by default, with colorized output and timestamps.
- The log level is controlled by the `LOG_LEVEL` environment variable or config.

### Usage Example

```typescript
import { logger } from "dynamic-mcp-server";

logger.info("Server started");
logger.error("Something went wrong", { error });
logger.debug("Debug details", { args: { foo: 1 } });
```

You can use the logger in your own code, handlers, or custom routes to output structured logs.

## Tool Registration

- `publishTool(toolDef: ToolDefinition)`: Register a tool in memory (per session).
- `addTool(toolDef: ToolDefinition, creator: string)`: Persist a tool to the database.

## Types

### Handler

```typescript
interface Handler {
  name: string;
  handler: (
    args: Record<string, any>,
    context: any,
    config: any,
  ) => Promise<any>;
  tools: ToolDefinition[];
}
```

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: {
    type: string;
    config: Record<string, any>;
  };
  rolesPermitted?: string[];
}
```

### HandlerOutput

```typescript
interface HandlerOutput {
  result: any;
  message?: string;
  nextSteps?: string[];
}
```

### SessionInfo

```typescript
interface SessionInfo {
  sessionId: string;
  user: {
    active: boolean;
    sub: string;
    email: string;
    name: string;
    preferred_username: string;
    scope: string[];
    aud: string[];
    [key: string]: any;
  };
  query?: Record<string, any>;
  mcpServer?: DynamicMcpServer;
}
```

See [User Management](./user-management.md) and [Tool Management](./tool-management.md) for more details.
