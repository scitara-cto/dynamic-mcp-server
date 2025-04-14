import axios from "axios";
import { config } from "../config/index.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

// Load environment variables
dotenv.config();

// Set log level to debug for more detailed output
logger.level = "debug";

async function main() {
  const realmUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}`;

  console.log("Checking realm configuration at:", realmUrl);

  try {
    const response = await axios.get(realmUrl, {
      validateStatus: (status) => true,
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", JSON.stringify(response.headers, null, 2));
    console.log("Response data:", JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log("Realm is accessible!");

      // Check client configuration
      const clientUrl = `${realmUrl}/clients-registrations/openid-connect/${config.auth.clientId}`;
      console.log("\nChecking client configuration at:", clientUrl);

      const clientResponse = await axios.get(clientUrl, {
        validateStatus: (status) => true,
      });

      console.log("Client response status:", clientResponse.status);

      if (clientResponse.status === 200) {
        const client = clientResponse.data;
        console.log("\nClient configuration:");
        console.log("Client ID:", client.client_id);
        console.log("Client enabled:", client.enabled);
        console.log("Client protocol:", client.protocol);
        console.log("Client public client:", client.public_client);
        console.log(
          "Client direct access grants enabled:",
          client.direct_access_grants_enabled,
        );
        console.log(
          "Client standard flow enabled:",
          client.standard_flow_enabled,
        );
        console.log(
          "Client service accounts enabled:",
          client.service_accounts_enabled,
        );
      } else {
        console.log(
          "\nFailed to get client configuration. Status:",
          clientResponse.status,
        );
        console.log("Error response:", clientResponse.data);
      }

      // Try to get token endpoint configuration
      const tokenEndpointUrl = `${realmUrl}/.well-known/openid-configuration`;
      console.log(
        "\nChecking token endpoint configuration at:",
        tokenEndpointUrl,
      );

      const tokenConfigResponse = await axios.get(tokenEndpointUrl, {
        validateStatus: (status) => true,
      });

      console.log("Token config response status:", tokenConfigResponse.status);

      if (tokenConfigResponse.status === 200) {
        const tokenConfig = tokenConfigResponse.data;
        console.log("\nToken endpoint configuration:");
        console.log("Token endpoint:", tokenConfig.token_endpoint);
        console.log(
          "Authorization endpoint:",
          tokenConfig.authorization_endpoint,
        );
        console.log("Userinfo endpoint:", tokenConfig.userinfo_endpoint);
      } else {
        console.log(
          "\nFailed to get token endpoint configuration. Status:",
          tokenConfigResponse.status,
        );
        console.log("Error response:", tokenConfigResponse.data);
      }
    } else {
      console.log("Failed to access realm. Status:", response.status);
    }
  } catch (error: any) {
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if (error.request) {
      console.error("No response received. Request details:", {
        method: error.request.method,
        path: error.request.path,
        headers: error.request.headers,
      });
    } else {
      console.error("Error setting up request:", error.message);
    }
  }
}

main().catch(console.error);
