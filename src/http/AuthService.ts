import axios from "axios";
import logger from "../utils/logger.js";

export interface UserInfo {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
  scope?: string[];
  aud?: string[];
  active?: boolean;
  claims?: any;
}

export interface AuthServiceConfig {
  authServerUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

export class AuthService {
  private config: AuthServiceConfig;

  constructor(config: AuthServiceConfig) {
    this.config = config;
  }

  /**
   * Introspect a token using the OAuth2 introspection endpoint
   */
  async introspectToken(token: string): Promise<any> {
    const url = `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token/introspect`;
    const params = new URLSearchParams();
    params.append("token", token);
    params.append("client_id", this.config.clientId);
    params.append("client_secret", this.config.clientSecret);
    try {
      const response = await axios.post(url, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return response.data;
    } catch (error: any) {
      logger.error(
        "Token introspection failed:",
        error.response?.data || error.message,
      );
      throw new Error("Token introspection failed");
    }
  }

  /**
   * Get user info from the userinfo endpoint
   */
  async getUserInfo(token: string): Promise<UserInfo> {
    const url = `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/userinfo`;
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error: any) {
      logger.error(
        "Failed to fetch user info:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to fetch user info");
    }
  }

  /**
   * Validate a token and return token data if valid, otherwise null
   */
  async validateToken(token: string): Promise<any | null> {
    try {
      const data = await this.introspectToken(token);
      if (data && data.active) return data;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract user info from token data
   */
  extractUserInfo(tokenData: any): UserInfo {
    return {
      ...tokenData,
      scope:
        typeof tokenData.scope === "string"
          ? tokenData.scope.split(" ").filter(Boolean)
          : Array.isArray(tokenData.scope)
          ? tokenData.scope
          : [],
      aud: Array.isArray(tokenData.aud) ? tokenData.aud : [],
    };
  }

  /**
   * Verify a token and return user info if valid, otherwise null
   */
  async verifyToken(token: string): Promise<UserInfo | null> {
    const data = await this.validateToken(token);
    if (data) return this.extractUserInfo(data);
    return null;
  }

  /**
   * Get an access token using username and password (Resource Owner Password Credentials Grant)
   */
  async getToken(username: string, password: string): Promise<string | null> {
    const url = `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("client_id", this.config.clientId);
    params.append("client_secret", this.config.clientSecret);
    params.append("username", username);
    params.append("password", password);
    try {
      const response = await axios.post(url, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (response.data && response.data.access_token) {
        return response.data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  }
}
