import axios from "axios";

interface DlxAuthConfig {
  authServerUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

interface DlxUserInfo {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  scope: string[];
}

export class DlxAuthService {
  private config: DlxAuthConfig;

  constructor(config: DlxAuthConfig) {
    this.config = config;
  }

  async verifyToken(token: string): Promise<DlxUserInfo | null> {
    try {
      const response = await axios.get(
        `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data as DlxUserInfo;
    } catch (error) {
      console.error("Error verifying token:", error);
      return null;
    }
  }

  async getToken(username: string, password: string): Promise<string | null> {
    try {
      const response = await axios.post(
        `${this.config.authServerUrl}/realms/${this.config.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: "password",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          username,
          password,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }
}
