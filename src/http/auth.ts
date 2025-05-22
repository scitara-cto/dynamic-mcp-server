import { Request, Response, NextFunction } from "express";
import { AuthService } from "./AuthService.js";
import logger from "../utils/logger.js";

export function createAuthMiddleware(authService: AuthService) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("No Bearer token provided");
      res.set("WWW-Authenticate", "Bearer");
      res.status(401).json({ error: "Unauthorized: No Bearer token provided" });
      return;
    }
    const token = authHeader.substring("Bearer ".length);
    try {
      const tokenData = await authService.introspectToken(token);
      if (!tokenData.active) {
        logger.warn("Token is not active");
        res.set("WWW-Authenticate", "Bearer");
        res.status(401).json({ error: "Unauthorized: Token is not active" });
        return;
      }
      (req as any).token = token;
      (req as any).tokenData = tokenData;
      next();
    } catch (error) {
      logger.error("Auth middleware error:", error);
      res.set("WWW-Authenticate", "Bearer");
      res
        .status(401)
        .json({ error: "Unauthorized: Token introspection failed" });
    }
  };
}
