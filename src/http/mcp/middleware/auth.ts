import { RequestHandler } from "express";
import { AuthService } from "./AuthService.js";
import logger from "../../../utils/logger.js";

export function createAuthMiddleware(authService: AuthService): RequestHandler {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        logger.warn("Authentication failed: No authorization header");
        res.status(401).json({ error: "No authorization header" });
        return;
      }

      // Check if it's a Bearer token
      const parts = authHeader.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        logger.warn("Authentication failed: Invalid authorization scheme");
        res.status(401).json({ error: "No token provided" });
        return;
      }

      const token = parts[1];
      if (!token) {
        logger.warn("Authentication failed: No token provided");
        res.status(401).json({ error: "No token provided" });
        return;
      }

      // Validate the token
      const tokenData = await authService.validateToken(token);
      if (!tokenData) {
        logger.warn("Authentication failed: Invalid token");
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      // Store token and token data in request for later use
      (req as any).token = token;
      (req as any).tokenData = tokenData;

      logger.debug(`Token validated for request`);
      next();
    } catch (error: unknown) {
      logger.error("Authentication error:", error);
      res.status(401).json({ error: "Authentication failed" });
    }
  };
}
