import { SessionInfo } from "../../../mcp/server.js";
import logger from "../../../utils/logger.js";
import { ToolOutput } from "../index.js";
import { handleDeleteToolAction } from "./deleteToolAction.js";
import { handleListToolsAction } from "./listToolsAction.js";
import { tools } from "./tools.js";

const actionHandlers: Record<
  string,
  (
    args: Record<string, any>,
    context: SessionInfo,
    handlerConfig: { action: string; tool?: string[] },
  ) => Promise<ToolOutput>
> = {
  delete: handleDeleteToolAction,
  list: handleListToolsAction,
};

/**
 * Tool Management handler for managing the tools list
 * @param args The arguments passed to the tool
 * @param context The session context containing authentication information
 * @param handlerConfig The handler configuration from the tool definition
 * @returns A promise that resolves to the tool output
 */
export async function toolManagementHandler(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: {
    action: string;
    tool?: string[];
  },
): Promise<ToolOutput> {
  try {
    const action = handlerConfig.action;
    const handler = actionHandlers[action];
    if (!handler) {
      throw new Error(`Unknown action: ${action}`);
    }
    return await handler(args, context, handlerConfig);
  } catch (error) {
    logger.error(`Tool Management handler error: ${error}`);
    throw error;
  }
}

export default {
  handler: toolManagementHandler,
  tools,
};
