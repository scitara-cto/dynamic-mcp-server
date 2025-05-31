import logger from "../../utils/logger.js";
import { ToolOutput } from "../../mcp/types.js";
import { toolManagementTools } from "./tools.js";
import { HandlerFunction, HandlerPackage } from "../../mcp/types.js";
import { handleDeleteToolAction } from "./actions/delete.js";
import { handleListToolsAction } from "./actions/list.js";
import { handleAddToolAction } from "./actions/add.js";
import { handleUpdateToolAction } from "./actions/update.js";

const actionHandlers: Record<
  string,
  (
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string; tool?: string[] },
  ) => Promise<ToolOutput>
> = {
  delete: handleDeleteToolAction,
  list: handleListToolsAction,
  add: handleAddToolAction,
  update: handleUpdateToolAction,
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
    logger.error(`Tool Management handler error: ${error}`);
    throw error;
  }
};

export const toolManagementHandlerPackage: HandlerPackage = {
  name: "tool-management",
  handler,
  tools: toolManagementTools,
  testScript: new URL("./test-script.md", import.meta.url).pathname,
};
