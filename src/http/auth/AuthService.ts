import axios from "axios";
import logger from "../../utils/logger.js";

interface AuthConfig {
  authServerUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

interface UserInfo {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  scope: string[];
  aud?: string[];
}

export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async verifyToken(token: string): Promise<UserInfo | null> {
    try {
      // Use token introspection instead of userinfo endpoint
      const response = await axios.post(
        `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token/introspect`,
        new URLSearchParams({
          token: token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      // Check if the token is active
      if (!response.data.active) {
        logger.warn("Token is not active");
        return null;
      }

      // Create a basic UserInfo object from the token claims
      // We'll use the sub claim as the user ID
      const userInfo: UserInfo = {
        sub: response.data.sub || "unknown",
        email: response.data.email || "",
        name: response.data.name || "",
        preferred_username: response.data.preferred_username || "",
        scope: response.data.scope ? response.data.scope.split(" ") : [],
        aud: response.data.aud ? [response.data.aud] : [],
      };

      return userInfo;
    } catch (error) {
      logger.error("Error verifying token:", error);
      return null;
    }
  }

  async getToken(username: string, password: string): Promise<string | null> {
    try {
      const tokenUrl = `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

      // Log the request details
      logger.debug(`Making token request to: ${tokenUrl}`);
      logger.debug(`Client ID: ${this.config.clientId}`);
      logger.debug(`Username: ${username}`);

      // Create the request body
      const formData = new URLSearchParams();
      formData.append("grant_type", "password");
      formData.append("client_id", this.config.clientId);
      formData.append("client_secret", this.config.clientSecret);
      formData.append("username", username);
      formData.append("password", password);

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

      if (response.status !== 200) {
        logger.error(`Token request failed with status ${response.status}`);
        logger.error(`Error response: ${JSON.stringify(response.data)}`);
        return null;
      }

      return response.data.access_token;
    } catch (error: any) {
      if (error.response) {
        logger.error(
          `Token request failed with status: ${error.response.status}`,
        );
        logger.error(`Error response: ${JSON.stringify(error.response.data)}`);
        logger.error(
          `Error response headers: ${JSON.stringify(error.response.headers)}`,
        );
      } else if (error.request) {
        logger.error(
          `No response received. Request details: ${JSON.stringify({
            method: error.request.method,
            path: error.request.path,
            headers: error.request.headers,
          })}`,
        );
      } else {
        logger.error(`Error setting up request: ${error.message}`);
      }
      return null;
    }
  }
}
