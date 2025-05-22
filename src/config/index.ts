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
  auth: {
    port: number;
    authServerUrl: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    redirectUri: string;
  };
  logging: {
    level: string;
    filePath: string;
  };
}

// Create and validate the configuration
function createConfig(): Config {
  const authServerUrl = process.env.KEYCLOAK_AUTH_SERVER_URL;
  const realm = process.env.KEYCLOAK_REALM;

  if (!authServerUrl || !realm) {
    throw new Error(
      "Missing required environment variables: KEYCLOAK_AUTH_SERVER_URL and/or KEYCLOAK_REALM",
    );
  }

  return {
    server: {
      port: parseInt(process.env.PORT || "4001", 10),
      name: "dynamic-mcp-server",
      version: "1.0.0",
    },
    auth: {
      port: parseInt(process.env.AUTH_PORT || "4000", 10),
      authServerUrl,
      realm,
      clientId: process.env.KEYCLOAK_CLIENT_ID || "",
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
      authorizationUrl: `${authServerUrl}/realms/${realm}/protocol/openid-connect/auth`,
      tokenUrl: `${authServerUrl}/realms/${realm}/protocol/openid-connect/token`,
      scopes: ["openid", "profile", "email"],
      redirectUri:
        process.env.KEYCLOAK_REDIRECT_URI || "http://localhost:4000/callback",
    },
    logging: {
      level: process.env.LOG_LEVEL || "info",
      filePath: process.env.LOG_FILE_PATH || "logs",
    },
  };
}

// Export the configuration instance
export const config = createConfig();
