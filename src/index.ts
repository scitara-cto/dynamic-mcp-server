import {
  DynamicMcpServer,
  Handler,
  DynamicMcpServerConfig,
  SessionInfo,
} from "./mcp/server.js";
import { ToolDefinition } from "./mcp/types.js";
import { HandlerOutput } from "./mcp/toolGenerator/ToolGenerator.js";
import logger from "./utils/logger.js";

function addAuthHttpRoute(
  serverInstance: DynamicMcpServer,
  method: "get" | "post",
  path: string,
  handler: import("express").RequestHandler,
) {
  const authServer = serverInstance.getAuthHttpServer();
  if (!authServer) throw new Error("Auth server not initialized");
  authServer.addHttpRoute(method, path, handler);
}

export { DynamicMcpServer, addAuthHttpRoute, logger };
export { UserRepository } from "./db/repositories/UserRepository.js";
export type { IUser } from "./db/models/User.js";
export type { ITool } from "./db/models/Tool.js";

export type {
  Handler,
  DynamicMcpServerConfig,
  SessionInfo,
  ToolDefinition,
  HandlerOutput,
};
