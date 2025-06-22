import { Request, Response, Router } from "express";
import logger from "../../utils/logger.js";

export function createHealthRoutes(): Router {
  const router = Router();

  // Health check endpoint
  router.get("/status", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Alternative health check endpoint
  router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  logger.info("Health check endpoints setup: /status, /health");
  return router;
}