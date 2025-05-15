# Dynamic MCP Server Framework

A flexible, extensible framework for building Model Context Protocol (MCP) servers with modern authentication, user management, and dynamic tool sharing.

---

## 🚀 Overview

Dynamic MCP Server enables secure, user-aware, and extensible AI tool servers. It supports:

- **OAuth-based authentication** (e.g., Keycloak)
- **User management and authorization** (MongoDB-backed)
- **Session-based, per-user tool loading**
- **Tool sharing and fine-grained access control**
- **Extensible HTTP and database layers for downstream projects**

---

## 🌟 Key Features

- **Dynamic Tool Management**: Create, delete, and authorize tools at runtime—tools are not limited to static definitions at startup or in code. This enables true runtime extensibility and is a primary differentiator from most other MCP servers.
- **User Management**: Add, update, delete, and list users; admin bootstrapping; role-based access.
- **Tool Sharing**: Share tools with other users, manage access levels, and receive real-time updates.
- **Modern Auth**: OAuth/Keycloak for authentication, MongoDB for authorization.
- **Extensibility**: Add custom HTTP routes and MongoDB collections in downstream projects.
- **Session-based Tool Loading**: Tools are loaded per user session, not globally.

---

## 📚 Documentation

- [Getting Started](./docs/getting-started.md)
- [User Management](./docs/user-management.md)
- [Tool Management & Sharing](./docs/tool-management.md)
- [Authentication & Authorization](./docs/authentication.md)
- [Extending the Server (HTTP & DB)](./docs/extending.md)
- [API Reference](./docs/api-reference.md)
- [Examples](./docs/examples.md)
- [Extending the Server: Creating Handler & Tool Packages](docs/tool_authoring.md)
- [Test Patterns & Mocking Strategies](docs/test_patterns.md)

---

## 🛠️ Quick Start

See [Getting Started](./docs/getting-started.md) for installation and basic usage.

---

## 📝 Contributing

Contributions are welcome! See [the documentation](./docs/) for more details.

## 📄 License

MIT

---

## 🧩 Handler & Tool Registration (New Pattern)

Tools are now registered via **handler packages**. Each handler package groups related tools and provides a handler function for tool execution. This is the recommended pattern for extensibility and maintainability.

**Example:**

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
    // ...more tools...
  ],
  handler: async (args, context, config, toolName) => {
    // Dispatch logic based on toolName, if needed
  },
};

const server = new DynamicMcpServer({ name: "my-mcp", version: "1.0.0" });
await server.start();
await server.registerHandler(myHandlerPackage);
```

See [Getting Started](./docs/getting-started.md) and [Examples](./docs/examples.md) for more details.
