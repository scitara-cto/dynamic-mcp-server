# Dynamic MCP Server Framework

A flexible, extensible framework for building Model Context Protocol (MCP) servers with modern API key authentication, user management, and dynamic tool sharing.

---

## 🚀 Overview

Dynamic MCP Server enables secure, user-aware, and extensible AI tool servers. It supports:

- **API key-based authentication** (simple, compatible with all MCP clients)
- **User management and authorization** (MongoDB-backed)
- **Session-based, per-user tool loading**
- **Tool sharing and fine-grained access control**
- **Extensible HTTP and database layers for downstream projects**

---

## 🌟 Key Features

- **Dynamic Tool Management**: Create, delete, and authorize tools at runtime—tools are not limited to static definitions at startup or in code. This enables true runtime extensibility and is a primary differentiator from most other MCP servers.
- **User Management**: Add, update, delete, and list users; admin bootstrapping; role-based access.
- **Tool Sharing**: Share tools with other users, manage access levels, and receive real-time updates.
- **Modern Auth**: Simple API key authentication, MongoDB for authorization.
- **Extensibility**: Add custom HTTP routes and MongoDB collections in downstream projects.
- **Session-based Tool Loading**: Tools are loaded per user session, not globally.

---

## 🔑 Authentication (API Key)

- Each user is assigned a unique `apiKey` (generated automatically on user creation).
- To authenticate, clients must provide the `apiKey` via query parameter OR header:
  - **Query Parameter**: `?apiKey=your-key` or `?apikey=your-key`
  - **Header**: `x-apikey: your-key` or `apikey: your-key`
- **SSE Transport (Legacy)**: `/sse?apiKey=...` or `/sse` with header
- **Streamable HTTP Transport (Modern)**: `/mcp?apiKey=...` or `/mcp` with header
- The server authenticates the user by looking up the `apiKey` in the database.

---

## 🚀 Transport Protocols

Dynamic MCP Server supports both legacy and modern MCP transport protocols:

### Streamable HTTP Transport (Recommended)
- **Protocol Version**: 2025-03-26
- **Endpoint**: `/mcp`
- **Features**: Modern, efficient, single-endpoint design
- **Authentication**: Query parameter `?apiKey=your-key` OR header `x-apikey: your-key`
- **Usage**: Recommended for new integrations

### SSE Transport (Legacy)
- **Protocol Version**: 2024-11-05
- **Endpoints**: `/sse` (connection) + `/messages` (communication)
- **Features**: Server-Sent Events based, backwards compatible
- **Authentication**: Query parameter `?apiKey=your-key` OR header `x-apikey: your-key`
- **Usage**: Maintained for existing integrations

Both transports work simultaneously and share the same authentication, user management, and tool execution systems.

---

## � Documentation

- [Getting Started](./docs/getting-started.md)
- [Transport Protocols](./docs/transport-protocols.md)
- [User Management](./docs/user-management.md)
- [Tool Management & Sharing](./docs/tool-management.md)
- [Authentication & Authorization](./docs/authentication.md)
- [Extending the Server (HTTP & DB)](./docs/extending.md)
- [API Reference](./docs/api-reference.md)
- [Examples](./docs/examples.md)
- [Extending the Server: Creating Handler & Tool Packages](docs/tool_authoring.md)
- [Test Patterns & Mocking Strategies](docs/test_patterns.md)

> **Tool Visibility Model:**
> All tools are visible to users by default. Users can hide tools from their view using the `hide-tool` and `unhide-tool` actions. See [User Management](./docs/user-management.md) and [Tool Management & Sharing](./docs/tool-management.md) for details.

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

---

## 🧩 Tool Argument Mapping (config.args)

When defining a tool, you can use the `config.args` field to map user-supplied tool options (from inputSchema) to the arguments your action handler expects. This mapping supports:

- Literal values (e.g., `"country": "US"`)
- Template variables (e.g., `"city": "{{location}}"`)
- Nested objects and arrays (all templates are resolved recursively)

**Example:**

```js
handler: {
  type: "weather-tools",
  config: {
    url: "https://api.openweathermap.org/data/2.5/weather",
    args: {
      queryParams: {
        appid: "{{OPENWEATHER_API_KEY}}",
        q: "{{location}}",
        units: "{{units}}"
      }
    }
  }
}
```

When the tool is called, the system automatically resolves all `{{...}}` templates in config.args using the tool input and environment variables. The handler receives the merged and resolved arguments—no manual mapping is needed.

See [Tool Authoring](./docs/tool_authoring.md) for full details and examples.

---

```

```
