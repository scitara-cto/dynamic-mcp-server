# Examples

## Base Server Example

A minimal server with tool management capabilities:

```bash
npm run example:base
```

Demonstrates:

- Basic server setup
- Built-in tool management
- Core tool registration

## Echo Server Example

A server with a custom echo handler:

```bash
npm run example:echo
```

Demonstrates:

- Custom handler implementation
- Tool registration via the handler's tools array

## Custom Handler Example

```typescript
const myHandler = {
  name: "my-handler",
  tools: [
    {
      name: "my-tool",
      description: "A custom tool",
      inputSchema: {
        type: "object",
        properties: {
          input: { type: "string" },
        },
      },
      handler: {
        type: "my-handler",
        config: { action: "process" },
      },
    },
  ],
  handler: async (args, context, config) => {
    return {
      result: { processed: args.input },
      message: "Processing complete",
    };
  },
};
```

## Web Service Handler Example

```typescript
const webServiceHandler = {
  name: "web-service",
  tools: [
    {
      name: "web-request",
      description: "Make HTTP requests to web services",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to request" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            default: "GET",
          },
          queryParams: {
            type: "object",
            additionalProperties: true,
            description: "Query parameters to include in the request",
          },
        },
        required: ["url"],
      },
      handler: {
        type: "web-service",
        config: {},
      },
    },
  ],
  handler: async (args, context, config) => {
    // ... see README for full example ...
  },
};
```

## Weather Tool Example

The weather server example demonstrates how to:

- Register a new tool handler (e.g., a web service handler for making HTTP requests)
- Register a tool (e.g., get-weather) that uses this handler to call an external API

First, the application defines and registers a handler capable of making web requests:

```typescript
const webServiceHandler = {
  name: "web-service",
  tools: [
    /* ... see below ... */
  ],
  handler: async (args, context, config) => {
    // Implementation for making HTTP requests
  },
};
server.registerHandler(webServiceHandler);
```

Then, it defines a tool that uses this handler to fetch weather data:

```typescript
const weatherTool = {
  name: "get-weather",
  description: "Get current weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      q: { type: "string", description: "City name or coordinates" },
      units: {
        type: "string",
        enum: ["metric", "imperial"],
        default: "metric",
      },
    },
    required: ["q"],
  },
  handler: {
    type: "web-service",
    config: {
      url: "https://api.openweathermap.org/data/2.5/weather",
      queryParams: {
        appid: "${OPENWEATHER_API_KEY}",
        q: "${q}",
        units: "${units}",
      },
    },
  },
};

// Register the tool with the handler
webServiceHandler.tools.push(weatherTool);
```

This pattern allows you to create reusable handlers and register multiple tools that leverage the same handler logic.

See [Getting Started](./getting-started.md) for more.

## Web Service & Weather Handler Example (Best Practice)

```js
const weatherHandlerPackage = {
  name: "weather-tools",
  tools: [
    {
      name: "web-request",
      description: "Make HTTP requests to web services",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to request" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            default: "GET",
          },
          queryParams: {
            type: "object",
            additionalProperties: true,
            description: "Query parameters to include in the request",
          },
        },
        required: ["url"],
      },
      handler: { type: "weather-tools", config: {} },
    },
    {
      name: "get-weather",
      description: "Get current weather for a location",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name or coordinates" },
          units: {
            type: "string",
            enum: ["metric", "imperial"],
            default: "metric",
          },
        },
        required: ["location"],
      },
      handler: {
        type: "weather-tools",
        config: {
          url: "https://api.openweathermap.org/data/2.5/weather",
          queryParams: {
            appid: "${OPENWEATHER_API_KEY}",
            q: "${location}",
            units: "${units}",
          },
        },
      },
    },
  ],
  handler: async (args, context, config, toolName) => {
    // Dispatch logic based on toolName
    const actualToolName = args.__toolName || toolName || context?.toolName;
    if (actualToolName === "web-request") {
      // ... web request logic ...
    } else if (actualToolName === "get-weather") {
      // ... weather logic ...
    } else {
      throw new Error(`Unknown tool: ${actualToolName}`);
    }
  },
};

await server.registerHandler(weatherHandlerPackage);
```

This pattern allows you to create reusable handlers and register multiple tools that leverage the same handler logic. See the [weather-server example](../examples/weather-server/index.js) for a full implementation.
