import { config } from "../config/index.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

// Load environment variables
dotenv.config();

// Set log level to debug for more detailed output
logger.level = "debug";

async function main() {
  const authUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/auth`;

  // Create the authorization URL parameters
  const params = new URLSearchParams({
    client_id: config.auth.clientId,
    response_type: "code",
    redirect_uri: config.auth.redirectUri,
    scope: "openid profile email",
    state: "random-state-value", // In a real app, this would be a random value
  });

  const fullAuthUrl = `${authUrl}?${params.toString()}`;

  console.log("Authorization URL:");
  console.log(fullAuthUrl);
  console.log("\nOpen this URL in your browser to authenticate.");
  console.log(
    "After authentication, you'll be redirected to your redirect URI with a code parameter.",
  );
  console.log(
    "Use that code with the get-token-with-code script to get an access token.",
  );
}

main().catch(console.error);
