# API Reference

## Tool Access & Usage Model

- A user can access a tool if:
  - Their roles overlap with the tool's `rolesPermitted` array, OR
  - The tool is in their `sharedTools`, OR
  - They are the creator, OR
  - The tool is a built-in system tool.
- The set of tools a user can access is called their **available tools** (computed dynamically).
- Users can "activate" (select for use) any available tool; these are tracked in the `usedTools` array (for personalization/filtering only, not for authorization).
- The `list-tools` action returns all tools, with `available` and `inUse` flags for each tool:
  - `available`: User is permitted to use this tool.
  - `inUse`: Tool is in the user's `usedTools` array.
- To add a tool to your `usedTools`, use the `use-tools` action.

See [User Management](./user-management.md) and [Tool Management](./tool-management.md) for more details.

## DynamicMcpServer

The main server class that handles tool registration, user management, and session handling.

```typescript
interface DynamicMcpServerConfig {
  name: string;
  version: string;
  port: number;
  host: string;
}

class DynamicMcpServer {
  constructor(config: DynamicMcpServerConfig);
  start(): Promise<void>;
  registerHandler(handler: Handler): void;
  toolGenerator: ToolGenerator;
}
```

## addAuthHttpRoute

Add a custom HTTP route to the Auth server:

```typescript
addAuthHttpRoute(
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
