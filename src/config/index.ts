import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Define the configuration interface
export interface Config {
  server: {
    port: number;
    name: string;
    version: string;
  };
  logging: {
    level: string;
    filePath: string;
  };
}

// Create and validate the configuration
function createConfig(): Config {
  return {
    server: {
      port: parseInt(process.env.PORT || "4001", 10),
      name: process.env.SERVER_NAME || "dynamic-mcp-server",
      version: process.env.SERVER_VERSION || "1.0.0",
    },
    logging: {
      level: process.env.LOG_LEVEL || "info",
      filePath: process.env.LOG_FILE_PATH || "logs",
    },
  };
}

// Export the configuration instance
export const config = createConfig();
