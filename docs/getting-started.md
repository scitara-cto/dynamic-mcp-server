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
  port: 3000,
  host: "localhost",
});

server.start().then(() => {
  console.log("MCP server started");
});
```

See the [Examples](./examples.md) for more advanced usage.

For more details on server instantiation and configuration options, see the [API Reference](./api-reference.md).

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
