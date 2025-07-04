import {
  DynamicMcpServer,
  DynamicMcpServerConfig,
  SessionInfo,
} from "./mcp/server.js";
import {
  HandlerFunction,
  HandlerPackage,
  ToolDefinition,
  PromptDefinition,
  PromptArgumentDefinition,
  PromptOutput,
  AuthRoute,
} from "./mcp/types.js";
import { HandlerOutput } from "./services/ToolService.js";
import logger from "./utils/logger.js";

export { DynamicMcpServer, logger };
export { UserRepository } from "./db/repositories/UserRepository.js";
export type { IUser } from "./db/models/User.js";
export type { ITool } from "./db/models/Tool.js";

export type {
  HandlerFunction,
  HandlerPackage,
  DynamicMcpServerConfig,
  SessionInfo,
  ToolDefinition,
  PromptDefinition,
  PromptArgumentDefinition,
  PromptOutput,
  HandlerOutput,
  AuthRoute,
};

export { sendEmail, sendBulkEmail } from "./services/EmailService.js";
