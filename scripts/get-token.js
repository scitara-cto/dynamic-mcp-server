import dotenv from "dotenv";
import { logger } from "dynamic-mcp-server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

// Set log level to debug for more detailed output
logger.level = "debug";

async function main() {
  const authUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/auth`;

  // Create the authorization URL parameters
  const params = new URLSearchParams({
    client_id: process.env.KEYCLOAK_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.KEYCLOAK_REDIRECT_URI,
    scope: "openid profile email",
    state: "random-state-value", // In a real app, this would be a random value
  });

  const fullAuthUrl = `${authUrl}?${params.toString()}`;

  console.log("Authorization URL:");
  console.log(fullAuthUrl);
  console.log("\nOpening browser with authorization URL...");

  // Open the URL in the default browser using the native open command
  await execAsync(`open "${fullAuthUrl}"`);

  console.log(
    "\nAfter authentication, you'll be redirected to your redirect URI with a code parameter.",
  );
  console.log(
    "Use that code with the get-token-with-code script to get an access token.",
  );
}

main().catch(console.error);
