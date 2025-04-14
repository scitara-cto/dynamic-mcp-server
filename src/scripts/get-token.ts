import { DlxAuthService } from "../services/DlxAuthService.js";
import { config } from "../config/index.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

// Load environment variables
dotenv.config();

// Set log level to debug for more detailed output
logger.level = "debug";

async function main() {
  const authService = new DlxAuthService({
    authServerUrl: config.auth.authServerUrl,
    realm: config.auth.realm,
    clientId: config.auth.clientId,
    clientSecret: config.auth.clientSecret,
  });

  // Replace these with your actual credentials
  const username = process.env.KEYCLOAK_USERNAME;
  const password = process.env.KEYCLOAK_PASSWORD;

  if (!username || !password) {
    console.error(
      "Please set KEYCLOAK_USERNAME and KEYCLOAK_PASSWORD in your .env file",
    );
    process.exit(1);
  }

  console.log("Attempting to get token with:");
  console.log("Auth Server URL:", config.auth.authServerUrl);
  console.log("Realm:", config.auth.realm);
  console.log("Client ID:", config.auth.clientId);
  console.log("Username:", username);

  try {
    const token = await authService.getToken(username, password);
    if (token) {
      console.log("Bearer", token);
    } else {
      console.error("Failed to get token");
    }
  } catch (error: any) {
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    }
    console.error("Error getting token:", error);
  }
}

main().catch(console.error);
