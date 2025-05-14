# Tool Authoring Guide

This guide explains how to create and register tools for the Dynamic MCP Server, including user-facing and internal/hidden tools.

---

## Tool Definition Fields

- **name** (required): Unique string identifier for the tool.
- **description**: Short description of what the tool does.
- **inputSchema** (required): JSON schema describing the tool's input arguments.
- **handler** (required): Object describing the handler type and config.
- **rolesPermitted**: Array of roles that can access this tool. See below for details.
- **annotations**: Optional metadata for UI and documentation.
- **creator**: String identifying the tool's creator (system, app name, or user email).

---

## User-Facing Tools

To make a tool available to users, specify the roles that should have access:

```js
rolesPermitted: ["user", "power-user", "admin"];
```

- Only users with at least one of these roles will see and be able to use the tool.
- There is **no automatic role inheritance**: if you want admins to have access, include "admin" explicitly.

---

## Internal/Hidden Tools

If you want to create a tool that is **not directly available to any user** (for example, a helper tool used only by other tools):

- Omit the `rolesPermitted` field, or set it to an empty array:

```js
rolesPermitted: []; // or simply omit
```

- Such tools will not appear in any user's available tool list and cannot be called directly by users.
- This is the recommended way to define internal or "hidden" tools.

---

## Best Practices

- **Be explicit**: Always specify `rolesPermitted` for user-facing tools.
- **Use internal tools for composition**: Build complex tools by composing internal/hidden tools.
- **Set a meaningful creator**: Use your app name for system/app tools, or an email for user-created tools.
- **Document your tool's purpose and input schema** for easier maintenance and UI integration.

---

## Example: User-Facing Tool

```js
const myTool = {
  name: "do-something",
  description: "Performs an action",
  inputSchema: { type: "object", properties: { foo: { type: "string" } } },
  handler: { type: "custom", config: {} },
  rolesPermitted: ["user", "admin"],
  creator: "my-app",
};
```

## Example: Internal/Hidden Tool

```js
const helperTool = {
  name: "helper",
  description: "Used internally by other tools",
  inputSchema: { type: "object", properties: { bar: { type: "number" } } },
  handler: { type: "custom", config: {} },
  // No rolesPermitted: hidden/internal
  creator: "my-app",
};
```

---

## Registering a Tool

To register a tool with the MCP server, use the `addTool` method on the server's tool generator. Pass your tool definition and a creator string (your app name or user email):

> **Note:** If you haven't yet instantiated an MCP server, see the [Getting Started guide](./getting-started.md) for setup instructions.

> **App Name Convention:** When you instantiate your MCP server, the `name` property is used as the default creator for tools registered by this app. Any tool registered without a creator will default to this name, making it easy to attribute and manage tools by application.

```js
const server = new DynamicMcpServer({
  name: "weather-mcp",
  version: "1.0.0",
});

// Example: Register a user-facing tool
server.toolGenerator.addTool(myTool); // creator defaults to server name

// Example: Register an internal/hidden tool
server.toolGenerator.addTool(helperTool); // creator defaults to server name
```

- The `creator` string should be your app name for system/app tools, or an email for user-created tools.
- You can call `addTool` at startup or dynamically at runtime.

---

For more details, see the main README or reach out to the maintainers.
