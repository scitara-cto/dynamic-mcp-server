# API Reference

## Authentication (API Key)

- All users (including admin) are assigned a unique `apiKey` for authentication.
- Clients must provide the `apiKey` as a query parameter (e.g., `/sse?apiKey=...`) when connecting.
- The server authenticates users by looking up the `apiKey` in the database.
- **Admins can view all user apiKeys in the server logs** when users connect, or at startup for the admin user.
- No OAuth or external identity provider is required.

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
