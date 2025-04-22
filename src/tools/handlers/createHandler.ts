import { SessionInfo } from "../../mcp/server.js";
import { ToolOutput } from "../types.js";
import { dlxHandler } from "./dlx/index.js";
import { toolManagementHandler } from "./toolManagement.js";
import logger from "../../utils/logger.js";

interface HandlerConfig {
  type: string;
  [key: string]: any;
}

/**
 * Creates a handler based on the handler configuration
 * @param args The arguments passed to the tool
 * @param context The session context containing authentication information
 * @param handlerConfig The handler configuration from the tool definition
 * @returns A promise that resolves to the tool output
 */
export async function createHandler(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: HandlerConfig,
): Promise<ToolOutput> {
  try {
    switch (handlerConfig.type) {
      case "dlx": {
        const { type, ...dlxConfig } = handlerConfig;
        return await dlxHandler(args, context, dlxConfig);
      }
      case "tool-management": {
        const { type, ...toolManagementConfig } = handlerConfig;
        return await toolManagementHandler(args, context, {
          action: toolManagementConfig.action || "list",
          tool: toolManagementConfig.tool,
        });
      }
      default:
        throw new Error(`Unknown handler type: ${handlerConfig.type}`);
    }
  } catch (error) {
    logger.error(`Handler error: ${error}`);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}
