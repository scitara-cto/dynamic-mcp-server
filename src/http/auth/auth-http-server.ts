import express, { Request, Response } from "express";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import {
  handleProtectedResourceMetadata,
  handleAuthorizationServerMetadata,
} from "./discovery.js";
import axios from "axios";

export class AuthHttpServer {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // OAuth discovery endpoints (no auth required)
    this.app.get(
      "/.well-known/oauth-protected-resource",
      handleProtectedResourceMetadata,
    );
    this.app.get(
      "/.well-known/oauth-authorization-server",
      handleAuthorizationServerMetadata,
    );

    // OAuth callback endpoint
    const handleCallback: express.RequestHandler = async (req, res) => {
      const { code, state } = req.query;

      if (state !== "random-state-value") {
        res.status(400).send("Invalid state parameter");
        return;
      }

      try {
        const tokenUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/token`;
        const formData = new URLSearchParams();
        formData.append("grant_type", "authorization_code");
        formData.append("client_id", config.auth.clientId);
        formData.append("client_secret", config.auth.clientSecret);
        formData.append("code", code as string);
        formData.append("redirect_uri", config.auth.redirectUri);

        const response = await axios.post(tokenUrl, formData, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        const { access_token, refresh_token } = response.data;

        // You can store the tokens in a secure way, such as in a database or a secure cookie
        // For this example, we'll just send them back to the client
        res.send(`
          <h1>Authorization Successful!</h1>
          <p>Access Token: ${access_token}</p>
          <p>Refresh Token: ${refresh_token}</p>
        `);
      } catch (error: any) {
        console.error(
          "Error exchanging code for token:",
          error.response?.data || error.message,
        );
        res.status(500).send("Error exchanging code for token");
      }
    };

    this.app.get("/callback", handleCallback);

    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });
  }

  public start(): void {
    const authPort = config.auth.port || 3000;
    try {
      this.app.listen(authPort, () => {
        logger.info(`Auth server started on port ${authPort}`);
      });
    } catch (error) {
      logger.error(`Failed to start Auth server: ${error}`);
    }
  }
}
