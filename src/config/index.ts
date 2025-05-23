import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Define the configuration interface
export interface Config {
  server: {
    port: number;
    name: string;
    version: string;
    url: string;
    adminEmail: string;
    mcpName: string;
  };
  logging: {
    level: string;
    filePath: string;
  };
  email: {
    postmarkApiToken: string;
    from: string;
  };
}

// Create and validate the configuration
function createConfig(): Config {
  return {
    server: {
      port: parseInt(process.env.PORT || "4001", 10),
      name: process.env.SERVER_NAME || "dynamic-mcp-server",
      version: process.env.SERVER_VERSION || "1.0.0",
      url: process.env.MCP_SERVER_URL || "",
      adminEmail: process.env.MCP_ADMIN_EMAIL || "",
      mcpName:
        process.env.MCP_SERVER_NAME ||
        process.env.SERVER_NAME ||
        "dynamic-mcp-server",
    },
    logging: {
      level: process.env.LOG_LEVEL || "info",
      filePath: process.env.LOG_FILE_PATH || "logs",
    },
    email: {
      postmarkApiToken: process.env.POSTMARK_API_TOKEN || "",
      from: process.env.SMTP_FROM || "",
    },
  };
}

// Export the configuration instance
export const config = createConfig();
