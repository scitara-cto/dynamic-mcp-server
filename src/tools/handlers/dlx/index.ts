import { SessionInfo } from "../../../mcp/server.js";
import { ToolOutput } from "../../index.js";
import logger from "../../../utils/logger.js";
import { handleApiCallAction } from "./apiCallAction.js";
import { handleUseConnectionAction } from "./useConnectionAction.js";
import { handleUseOrchestrationAction } from "./useOrchestrationAction.js";
import { tools } from "./tools.js";

const actionHandlers: Record<
  string,
  (
    args: Record<string, any>,
    context: SessionInfo,
    actionConfig: any,
  ) => Promise<ToolOutput>
> = {
  "api-call": handleApiCallAction,
  "use-connection": handleUseConnectionAction,
  "use-orchestration": handleUseOrchestrationAction,
};

/**
 * DLX handler for executing various actions with the DLX service
 * @param args The arguments passed to the tool
 * @param context The session context containing authentication information
 * @param actionConfig The handler configuration from the tool definition
 * @returns A promise that resolves to the tool output
 */
export async function dlxHandler(
  args: Record<string, any>,
  context: SessionInfo,
  actionConfig: any,
): Promise<ToolOutput> {
  try {
    const handler = actionHandlers[actionConfig.action];
    if (!handler) {
      throw new Error(`Unknown action: ${actionConfig.action}`);
    }
    return await handler(args, context, actionConfig);
  } catch (error) {
    logger.error(`DLX handler error: ${error}`);
    throw error;
  }
}

export default {
  handler: dlxHandler,
  tools,
};
