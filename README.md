# Dynamic MCP Server Framework

A flexible and extensible framework for building Model Context Protocol (MCP) servers that conforms to the [Model Context Protocol specification](https://modelcontextprotocol.io/). This framework enables both static and dynamic tool registration, allowing tools to be defined at runtime as well as compile time.

## Key Features

- **Dynamic Tool Registration**: Tools can be defined and registered at runtime, enabling flexible and adaptive tool management
- **Handler-Based Architecture**: Custom handlers implement specific functionalities that can be called by dynamically defined tools
- **Extensible Design**: Easy to add new handlers and tool types through a clean, type-safe API
- **Built-in Tool Management**: Core functionality for managing and monitoring registered tools
- **MCP Specification Compliance**: Fully compliant with the Model Context Protocol specification

## How It Works

The framework operates on a handler-based architecture where:

1. **Handlers** implement specific functionalities (e.g., web services, file operations, database queries)
2. **Tools** are defined to use these handlers with specific configurations
3. **Dynamic Registration** allows tools to be created and registered at runtime
4. **Tool Management** provides core functionality for listing and managing tools

This architecture enables powerful use cases where:

- Clients can define custom tools that use existing handlers
- Handlers can be reused across multiple tools
- Tools can be dynamically created and configured
- The system remains type-safe and maintainable

## Installation

```bash
npm install dynamic-mcp-server
```

## Quick Start

### Basic Server Setup

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

### Creating a Custom Handler

Create a custom handler as a plain object with `name`, `handler`, and `tools`:

```typescript
import { DynamicMcpServer } from "dynamic-mcp-server";

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

const server = new DynamicMcpServer({
  /* config */
});
server.registerHandler(myHandler);
```

### Complex Example: Web Service Handler

```typescript
import { DynamicMcpServer } from "dynamic-mcp-server";

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
    const method = args.method || "GET";
    const baseUrl = config.url || args.url;
    const queryParams = {
      ...(config.queryParams || {}),
      ...(args.queryParams || {}),
    };
    const resolvedParams = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (
        typeof value === "string" &&
        value.startsWith("${") &&
        value.endsWith("}")
      ) {
        const varName = value.slice(2, -1);
        resolvedParams[key] = args[varName] || process.env[varName] || "";
      } else {
        resolvedParams[key] = value;
      }
    }
    const urlObj = new URL(baseUrl);
    Object.entries(resolvedParams).forEach(([k, v]) => {
      if (v !== undefined && v !== "") urlObj.searchParams.append(k, v);
    });
    const body =
      method === "POST" || method === "PUT"
        ? JSON.stringify(args.body)
        : undefined;
    const response = await fetch(urlObj.toString(), {
      method,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      ...(body && { body }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { result: data, message: "Request successful" };
  },
};

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

webServiceHandler.tools.push(weatherTool);

const server = new DynamicMcpServer({
  name: "weather-mcp-server",
  version: "1.0.0",
  port: 3000,
  host: "localhost",
});
server.registerHandler(webServiceHandler);
```

This example demonstrates:

1. Creating a reusable web service handler
2. Defining a specific weather tool that uses the handler
3. Dynamic tool registration via the handler's tools array
4. Environment variable usage in tool configuration
5. Complex input schema definition

## Examples

The framework includes several example implementations to help you get started:

### Base Server

A minimal server with tool management capabilities:

```bash
npm run example:base
```

This example demonstrates:

- Basic server setup
- Built-in tool management
- Core tool registration

### Echo Server

A server with a custom echo handler:

```bash
npm run example:echo
```

This example demonstrates:

- Custom handler implementation
- Tool registration via the handler's tools array

## API Reference

### DynamicMcpServer

The main server class that handles tool registration and management.

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

### Handler

Interface for implementing custom handlers:

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

Interface for defining tools.

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

### Types

#### HandlerOutput

The `HandlerOutput` interface defines the expected return type for tool handlers:

```typescript
interface HandlerOutput {
  result: any; // The main output of the handler
  message?: string; // Optional message providing additional context
  nextSteps?: string[]; // Optional array of suggested next actions
}
```

When implementing a handler, you should return an object that matches this interface. For example:

```typescript
const myHandler = async (args: any, context: any): Promise<HandlerOutput> => {
  return {
    result: {
      /* your handler's result */
    },
    message: "Optional message about the operation",
    nextSteps: ["Optional suggested next steps"],
  };
};
```

## Tool Access Control

The framework supports fine-grained control over which tools are available to users through Keycloak attributes. This is implemented using two attributes:

### toolsAvailable

This attribute specifies which tools a user or group has access to. In Keycloak, this should be set as a comma-delimited string:

```
web-request, get-weather, admin-tool
```

If `toolsAvailable` is not set, the user has access to all tools by default.

### toolsHidden

This attribute specifies which tools should be hidden from a user or group, even if they are in `toolsAvailable`. In Keycloak, this should also be set as a comma-delimited string:

```
admin-tool, debug-tool
```

### Example Scenarios

1. **Allow specific tools only:**
   In Keycloak, set the `toolsAvailable` attribute to:

   ```
   web-request, get-weather
   ```

2. **Hide specific tools:**
   In Keycloak, set the `toolsHidden` attribute to:

   ```
   admin-tool, debug-tool
   ```

3. **Combined usage:**
   In Keycloak, set both attributes:
   ```
   toolsAvailable: web-request, get-weather, admin-tool
   toolsHidden: admin-tool
   ```
   In this case, the user will only have access to `web-request` and `get-weather`, as `admin-tool` is hidden.

### Setting Attributes in Keycloak

1. Navigate to your Keycloak admin console
2. Select your realm
3. Go to Users or Groups
4. Add the attributes:
   - For users: Edit user → Attributes
   - For groups: Select group → Attributes
   - Enter the tool names as comma-delimited strings

The framework will automatically convert these comma-delimited strings into arrays when processing the user's token.

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Running Examples in Development Mode

```bash
# Base server example
npm run example:base

# Echo server example
npm run example:echo
```

## License

MIT
