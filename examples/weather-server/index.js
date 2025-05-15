import { DynamicMcpServer, logger } from "../../dist/index.js";
import dotenv from "dotenv";
dotenv.config();

// Combined Weather Handler Package
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
          body: {
            type: "object",
            additionalProperties: true,
            description: "Request body for POST/PUT methods",
          },
        },
        required: ["url"],
      },
      rolesPermitted: [],
      annotations: {
        title: "Web Service",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      handler: {
        type: "weather-tools",
        config: {},
      },
    },
    {
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
      rolesPermitted: ["user", "power-user", "admin"],
      annotations: {
        title: "Weather",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
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
    // toolName is not passed by default, so infer from context if possible
    const actualToolName = args.__toolName || toolName || context?.toolName;
    if (actualToolName === "web-request") {
      // Web request logic
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
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return { result: data, message: "Request successful" };
    } else if (actualToolName === "get-weather") {
      // Weather tool logic (uses web request logic with weather config)
      const method = "GET";
      const baseUrl = config.url;
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
      const response = await fetch(urlObj.toString(), {
        method,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return { result: data, message: "Weather request successful" };
    } else {
      throw new Error(`Unknown tool: ${actualToolName}`);
    }
  },
};

(async () => {
  // Setup server with weather handler
  const server = new DynamicMcpServer({
    name: "weather-mcp",
    version: "1.0.0",
  });

  // Check if OPENWEATHER_API_KEY is set
  if (!process.env.OPENWEATHER_API_KEY) {
    logger.info(
      "Note: You need to set the OPENWEATHER_API_KEY environment variable to use the weather tool. Get an API key from https://openweathermap.org/",
    );
    process.exit(1);
  }
  logger.info("OPENWEATHER_API_KEY is set");

  // Start the server (connects to MongoDB)
  await server.start();

  // Register the combined weather handler package
  await server.registerHandler(weatherHandlerPackage);

  // Start the server HTTP listeners (if not already started in server.start)
  logger.info("Weather MCP Server started");
  logger.info("Available at http://localhost:3000");
})();
