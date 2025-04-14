import axios from "axios";
import { config } from "../config/index.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

// Load environment variables
dotenv.config();

// Set log level to debug for more detailed output
logger.level = "debug";

async function main() {
  const tokenUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/token`;

  console.log("Attempting to get client token with service account:");
  console.log("Auth Server URL:", config.auth.authServerUrl);
  console.log("Realm:", config.auth.realm);
  console.log("Client ID:", config.auth.clientId);

  try {
    // Create the request body
    const formData = new URLSearchParams();
    formData.append("grant_type", "client_credentials");
    formData.append("client_id", config.auth.clientId);
    formData.append("client_secret", config.auth.clientSecret);

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
      console.log("Successfully got client token!");
      console.log("Bearer", response.data.access_token);

      // Try to get user info with the token
      const userInfoUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/userinfo`;
      console.log("\nAttempting to get user info with the token:");

      const userInfoResponse = await axios.get(userInfoUrl, {
        headers: {
          Authorization: `Bearer ${response.data.access_token}`,
        },
        validateStatus: (status) => true, // Don't throw on any status
      });

      console.log("User info response status:", userInfoResponse.status);

      if (userInfoResponse.status === 200) {
        console.log("Successfully got user info!");
        console.log(
          "User info:",
          JSON.stringify(userInfoResponse.data, null, 2),
        );
      } else {
        console.error(
          "Failed to get user info. Status:",
          userInfoResponse.status,
        );
        console.error("Error response:", userInfoResponse.data);
      }
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
