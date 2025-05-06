import { DynamicMcpServer } from "../../dist/index.js";

// Web Service Handler
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
          body: {
            type: "object",
            additionalProperties: true,
            description: "Request body for POST/PUT methods",
          },
        },
        required: ["url"],
      },
      annotations: {
        title: "Web Service",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
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
    // Merge query params from config and args
    const queryParams = {
      ...(config.queryParams || {}),
      ...(args.queryParams || {}),
    };

    // Substitute template variables in queryParams
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

    // Build URL with query params
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

// Weather Tool using Web Service Handler
const weatherTool = {
  name: "get-weather",
  description: "Get current weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or coordinates",
      },
      units: {
        type: "string",
        enum: ["metric", "imperial"],
        default: "metric",
      },
    },
    required: ["location"],
  },
  annotations: {
    title: "Weather",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: {
    type: "web-service",
    config: {
      url: "https://api.openweathermap.org/data/2.5/weather",
      queryParams: {
        appid: "${OPENWEATHER_API_KEY}",
        q: "${location}",
        units: "${units}",
      },
    },
  },
};

// Setup server with web service handler
const server = new DynamicMcpServer({
  name: "weather-mcp-server",
  version: "1.0.0",
  port: 4001,
  host: "localhost",
});

// Register the web service handler
server.registerHandler(webServiceHandler);

// No need to manually register the weather tool; it's handled by the handler registration.
server.toolGenerator.registerTool(weatherTool);

// Start the server
server.start().then(() => {
  console.log("Weather MCP Server started");
  console.log("Available at http://localhost:3000");
  console.log(
    "\nNote: You need to set the OPENWEATHER_API_KEY environment variable",
  );
  console.log(
    "to use the weather tool. Get an API key from https://openweathermap.org/",
  );
});
