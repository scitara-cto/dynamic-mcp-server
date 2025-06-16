import logger from "../../utils/logger.js";
import { PromptOutput } from "../../mcp/types.js";
import { promptManagementPrompts } from "./prompts.js";
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
    handlerConfig: { action: string; prompt?: string[] },
  ) => Promise<PromptOutput>
> = {
  list: handleListPromptsAction,
  add: handleAddPromptAction,
  delete: handleDeletePromptAction,
  update: handleUpdatePromptAction,
};

const handler: HandlerFunction = async (
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string; prompt?: string[] },
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
  tools: [], // No tools for this handler, only prompts
  prompts: promptManagementPrompts,
};