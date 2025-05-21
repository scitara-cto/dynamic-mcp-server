import {
  DynamicMcpServer,
  DynamicMcpServerConfig,
  SessionInfo,
} from "./mcp/server.js";
import {
  HandlerFunction,
  HandlerPackage,
  ToolDefinition,
} from "./mcp/types.js";
import { HandlerOutput } from "./services/ToolService.js";
import logger from "./utils/logger.js";

function addCustomHttpRoute(
  serverInstance: DynamicMcpServer,
  method: "get" | "post",
  path: string,
  handler: import("express").RequestHandler,
) {
  const httpServer = serverInstance.getHttpServer();
  if (!httpServer) throw new Error("HTTP server not initialized");
  httpServer.addHttpRoute(method, path, handler);
}

export { DynamicMcpServer, addCustomHttpRoute, logger };
export { UserRepository } from "./db/repositories/UserRepository.js";
export type { IUser } from "./db/models/User.js";
export type { ITool } from "./db/models/Tool.js";

export type {
  HandlerFunction,
  HandlerPackage,
  DynamicMcpServerConfig,
  SessionInfo,
  ToolDefinition,
  HandlerOutput,
};
