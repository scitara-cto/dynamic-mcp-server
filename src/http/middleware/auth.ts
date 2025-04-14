import { RequestHandler } from "express";
import { DlxAuthService } from "../../services/DlxAuthService.js";
import logger from "../../utils/logger.js";

export function createAuthMiddleware(
  authService: DlxAuthService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        logger.warn("Authentication failed: No authorization header");
        res.status(401).json({ error: "No authorization header" });
        return;
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        logger.warn("Authentication failed: No token provided");
        res.status(401).json({ error: "No token provided" });
        return;
      }

      // Verify token with DLX Auth service
      const userInfo = await authService.verifyToken(token);
      if (!userInfo) {
        logger.warn("Authentication failed: Invalid token");
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      // Add user info to request
      (req as any).user = userInfo;
      logger.debug(`User authenticated: ${userInfo.sub}`);
      next();
    } catch (error: unknown) {
      logger.error("Authentication error:", error);
      res.status(401).json({ error: "Authentication failed" });
    }
  };
}
