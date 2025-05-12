# API Reference

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
