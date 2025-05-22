import { Request, Response } from "express";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";

/**
 * Handler for the MCP client registration endpoint
 * This endpoint allows clients to dynamically register with the MCP server
 */
export function handleClientRegistration(req: Request, res: Response): void {
  logger.debug("Client registration requested", req.body);

  try {
    // Extract client metadata from request body
    const clientMetadata = req.body;

    // Validate required fields
    if (!clientMetadata.client_name) {
      logger.error("Client registration failed: Missing client_name");
      res.status(400).json({ error: "client_name is required" });
      return;
    }

    // Use the existing client ID and secret from the environment variables
    // This ensures the client can authenticate with Keycloak
    const clientInfo = {
      client_id: config.auth.clientId,
      client_secret: config.auth.clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // No expiration
      ...clientMetadata,
    };

    logger.info(`Client registered successfully: ${config.auth.clientId}`);
    res.status(201).json(clientInfo);
  } catch (error) {
    logger.error(`Client registration failed: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
}
