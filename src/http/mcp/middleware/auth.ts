import { RequestHandler } from "express";
import { AuthService } from "../../auth/AuthService.js";
import logger from "../../../utils/logger.js";
import { McpServer } from "../../../mcp/server.js";
import { Request, Response, NextFunction } from "express";

// TODO: Remove this interface when API key auth is no longer needed
interface ApiKeyUser {
  sub: string;
  dlxApiKey: string;
  dlxApiUrl: string;
}

// TODO: Remove this function when API key auth is no longer needed
async function authenticateWithApiKey(
  req: Request,
  mcpServer: McpServer,
): Promise<ApiKeyUser | null> {
  // First try session info if available
  const sessionId = req.query.sessionId as string | undefined;
  if (sessionId) {
    const sessionInfo = mcpServer.getSessionInfo(sessionId);
    logger.debug(`Session info found: ${!!sessionInfo}`);

    if (sessionInfo?.dlxApiKey && sessionInfo?.dlxApiUrl) {
      return {
        sub: "dlx-api-user",
        dlxApiKey: sessionInfo.dlxApiKey,
        dlxApiUrl: sessionInfo.dlxApiUrl,
      };
    }
  }

  // Fall back to query parameters
  const dlxApiKey = req.query.dlxApiKey as string | undefined;
  const dlxApiUrl = req.query.dlxApiUrl as string | undefined;

  logger.debug(`DLX API Key present: ${!!dlxApiKey}`);
  logger.debug(`DLX API URL present: ${!!dlxApiUrl}`);

  if (dlxApiKey && dlxApiUrl) {
    return {
      sub: "dlx-api-user",
      dlxApiKey,
      dlxApiUrl,
    };
  }

  return null;
}

async function authenticateWithOAuth(
  req: Request,
  authService: AuthService,
): Promise<any | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("No authorization header");
  }

  // Check if it's a Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid authorization header format");
  }

  const token = parts[1];
  if (!token) {
    throw new Error("No token provided");
  }

  // Verify token with DLX Auth service
  try {
    const userInfo = await authService.verifyToken(token);
    if (!userInfo) {
      throw new Error("Invalid token");
    }
    return userInfo;
  } catch (error) {
    // Convert verification errors to invalid token errors
    throw new Error("Invalid token");
  }
}

export function createAuthMiddleware(
  authService: AuthService,
  mcpServer: McpServer,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // First try API key authentication
      const apiKeyUser = await authenticateWithApiKey(req, mcpServer);
      if (apiKeyUser) {
        (req as any).user = apiKeyUser;
        logger.debug("Using DLX API key authentication");
        next();
        return;
      }

      // If no API key auth, try OAuth authentication
      try {
        const oauthUser = await authenticateWithOAuth(req, authService);
        (req as any).user = oauthUser;
        logger.debug(`User authenticated via OAuth: ${oauthUser.sub}`);
        next();
        return;
      } catch (error: any) {
        // Only return OAuth-specific errors if there was an authorization header
        // This indicates the client was attempting OAuth auth
        if (req.headers.authorization) {
          logger.warn("OAuth authentication failed:", error.message);
          res.status(401).json({ error: error.message });
          return;
        }
      }

      // If we get here, neither auth method succeeded
      logger.warn("Authentication failed: No valid authentication method");
      res.status(401).json({ error: "Authentication failed" });
    } catch (error: unknown) {
      logger.error("Authentication error:", error);
      res.status(401).json({ error: "Authentication failed" });
    }
  };
}
