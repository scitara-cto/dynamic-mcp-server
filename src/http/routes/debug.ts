import { Request, Response, Router } from "express";
import { SessionManager } from "../services/session-manager.js";

export function createDebugRoutes(sessionManager: SessionManager): Router {
  const router = Router();

  // Debug endpoint to list active sessions
  router.get("/sessions", (_req: Request, res: Response) => {
    res.json({
      activeSessions: sessionManager.getActiveSessions(),
      count: sessionManager.getSessionCount(),
    });
  });

  return router;
}