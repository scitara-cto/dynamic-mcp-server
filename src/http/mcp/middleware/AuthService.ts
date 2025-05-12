import axios from "axios";
import logger from "../../../utils/logger.js";

interface AuthConfig {
  authServerUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

export interface UserInfo {
  active: boolean;
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  scope: string[];
  aud: string[];
  [key: string]: any; // Allow any additional claims from the token
}

interface TokenValidationResult {
  active: boolean;
  [key: string]: any; // Allow any additional claims from the token
}

export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async validateToken(token: string): Promise<TokenValidationResult | null> {
    try {
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

      if (!response.data.active) {
        logger.warn("Token is not active");
        return null;
      }

      return response.data;
    } catch (error) {
      logger.error("Error validating token:", error);
      return null;
    }
  }

  extractUserInfo(tokenData: TokenValidationResult): UserInfo {
    return {
      ...tokenData,
      active: tokenData.active,
      sub: tokenData.sub || "",
      email: tokenData.email || "",
      name: tokenData.name || "",
      preferred_username: tokenData.preferred_username || "",
      scope: tokenData.scope ? tokenData.scope.split(" ") : [],
      aud: tokenData.aud
        ? Array.isArray(tokenData.aud)
          ? tokenData.aud
          : [tokenData.aud]
        : [],
    };
  }

  async verifyToken(token: string): Promise<UserInfo | null> {
    const tokenData = await this.validateToken(token);
    if (!tokenData) {
      return null;
    }
    return this.extractUserInfo(tokenData);
  }

  async getToken(username: string, password: string): Promise<string | null> {
    try {
      const tokenUrl = `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

      // Create the request body
      const formData = new URLSearchParams();
      formData.append("grant_type", "password");
      formData.append("client_id", this.config.clientId);
      formData.append("client_secret", this.config.clientSecret);
      formData.append("username", username);
      formData.append("password", password);

      // Make the request
      const response = await axios.post(tokenUrl, formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        validateStatus: (status) => true, // Don't throw on any status
      });

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
