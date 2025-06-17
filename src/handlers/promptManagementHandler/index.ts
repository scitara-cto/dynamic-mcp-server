import logger from "../../utils/logger.js";
import { ToolOutput } from "../../mcp/types.js";
import { promptManagementTools } from "./tools.js";
import { HandlerFunction, HandlerPackage } from "../../mcp/types.js";
import { handleListPromptsAction } from "./actions/list.js";
import { handleAddPromptAction } from "./actions/add.js";
import { handleDeletePromptAction } from "./actions/delete.js";
import { handleUpdatePromptAction } from "./actions/update.js";

const actionHandlers: Record<
  string,
  (
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string; tool?: string[] },
  ) => Promise<ToolOutput>
> = {
  list: handleListPromptsAction,
  add: handleAddPromptAction,
  delete: handleDeletePromptAction,
  update: handleUpdatePromptAction,
};

const handler: HandlerFunction = async (
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string; tool?: string[] },
) => {
  try {
    const action = handlerConfig.action;
    const fn = actionHandlers[action];
    if (!fn) {
      throw new Error(`Unknown action: ${action}`);
    }
    return await fn(args, context, handlerConfig);
  } catch (error) {
    logger.error(`Prompt Management handler error: ${error}`);
    throw error;
  }
};

export const promptManagementHandlerPackage: HandlerPackage = {
  name: "prompt-management",
  handler,
  tools: promptManagementTools,
  prompts: [], // No prompts for this handler, only tools
};