import axios from "axios";
import { config } from "../config/index.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

// Load environment variables
dotenv.config();

// Set log level to debug for more detailed output
logger.level = "debug";

async function main() {
  // Get the authorization code from command line arguments
  const code = process.argv[2];
  if (!code) {
    console.error(
      "Please provide the authorization code as a command line argument.",
    );
    console.error("Usage: npm run get-token-with-code -- <code>");
    process.exit(1);
  }

  const tokenUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/token`;

  console.log("Attempting to get token with authorization code:");
  console.log("Auth Server URL:", config.auth.authServerUrl);
  console.log("Realm:", config.auth.realm);
  console.log("Client ID:", config.auth.clientId);

  try {
    // Create the request body
    const formData = new URLSearchParams();
    formData.append("grant_type", "authorization_code");
    formData.append("client_id", config.auth.clientId);
    formData.append("client_secret", config.auth.clientSecret);
    formData.append("code", code);
    formData.append("redirect_uri", config.auth.redirectUri);

    logger.debug(`Making token request to: ${tokenUrl}`);
    logger.debug(`Request body: ${formData.toString()}`);

    // Make the request
    const response = await axios.post(tokenUrl, formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      validateStatus: (status) => true, // Don't throw on any status
    });

    // Log the response
    logger.debug(`Response status: ${response.status}`);
    logger.debug(`Response headers: ${JSON.stringify(response.headers)}`);
    logger.debug(`Response data: ${JSON.stringify(response.data)}`);

    if (response.status === 200) {
      console.log("Successfully got token!");
      console.log("Bearer", response.data.access_token);
    } else {
      console.error(`Token request failed with status ${response.status}`);
      console.error(`Error response: ${JSON.stringify(response.data)}`);
    }
  } catch (error: any) {
    if (error.response) {
      console.error(
        `Token request failed with status: ${error.response.status}`,
      );
      console.error(`Error response: ${JSON.stringify(error.response.data)}`);
      console.error(
        `Error response headers: ${JSON.stringify(error.response.headers)}`,
      );
    } else if (error.request) {
      console.error(
        `No response received. Request details: ${JSON.stringify({
          method: error.request.method,
          path: error.request.path,
          headers: error.request.headers,
        })}`,
      );
    } else {
      console.error(`Error setting up request: ${error.message}`);
    }
  }
}

main().catch(console.error);
