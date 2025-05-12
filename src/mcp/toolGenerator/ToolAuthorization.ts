import { UserRepository } from "../../db/repositories/UserRepository.js";
import logger from "../../utils/logger.js";

export class ToolAuthorization {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async authorizeToolCall(userEmail: string | undefined, toolName: string) {
    if (!userEmail) {
      logger.error(`No user email provided for tool authorization`);
      this.auditLog("authorization_failed", userEmail, toolName, "no_email");
      return {
        authorized: false,
        error:
          "No user email found in session context. Please contact the administrator.",
      };
    }

    // Look up user in MongoDB
    const user = await this.userRepository.findByEmail(userEmail);
    if (!user) {
      logger.warn(`User not found in DB: ${userEmail}`);
      this.auditLog(
        "authorization_failed",
        userEmail,
        toolName,
        "user_not_found",
      );
      return {
        authorized: false,
        error:
          "You are not registered. Please contact the administrator to be added.",
      };
    }

    // Check tool access
    const hasAccess = await this.userRepository.checkToolAccess(
      userEmail,
      toolName,
    );
    if (!hasAccess) {
      logger.warn(`User ${userEmail} not authorized for tool ${toolName}`);
      this.auditLog(
        "authorization_failed",
        userEmail,
        toolName,
        "not_authorized",
      );
      return {
        authorized: false,
        error:
          "You are not authorized to access this tool. Please contact the administrator if you believe this is an error.",
      };
    }
    this.auditLog("authorization_success", userEmail, toolName, "authorized");
    return { authorized: true };
  }

  private auditLog(
    event: string,
    userEmail: string | undefined,
    toolName: string,
    status: string,
  ) {
    logger.info(
      `[AUDIT] event=${event} user=${userEmail} tool=${toolName} status=${status}`,
    );
  }
}
