import { Request } from "express";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { AuthResult } from "../types.js";
import logger from "../../utils/logger.js";

export class AuthService {
  /**
   * Extract and validate authentication from request
   */
  static async authenticateRequest(req: Request): Promise<AuthResult> {
    const apiKey = req.query.apiKey ||
                   req.query.apikey ||
                   req.headers["x-apikey"] ||
                   req.headers["apikey"];
                   
    if (!apiKey) {
      return { success: false, error: "Missing apiKey" };
    }

    const userRepo = new UserRepository();
    const user = await userRepo.findByApiKey(apiKey as string);
    
    if (!user) {
      logger.warn(`Invalid apiKey attempt: apiKey=${apiKey}, ip=${req.ip}`);
      return {
        success: false,
        error: "Invalid apiKey. Please contact the administrator to request access or a valid API key."
      };
    }

    logger.debug(`[AUTH] User authenticated: email=${user.email}, apiKey=${user.apiKey}`);
    return { success: true, user };
  }
}