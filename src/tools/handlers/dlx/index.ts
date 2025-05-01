import { SessionInfo } from "../../../mcp/server.js";
import { ToolOutput } from "../index.js";
import logger from "../../../utils/logger.js";
import { handleApiCallAction } from "./apiCallAction.js";
import { handleUseConnectionAction } from "./useConnectionAction.js";
import { handleUseOrchestrationAction } from "./useOrchestrationAction.js";
import { handleTriggerOrchestrationAction } from "./triggerOrchestrationAction.js";

/**
 * DLX handler for executing various actions with the DLX service
 * @param args The arguments passed to the tool
 * @param context The session context containing authentication information
 * @param handlerConfig The handler configuration from the tool definition
 * @returns A promise that resolves to the tool output
 */
export async function dlxHandler(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: {
    action?: string;
    path?: string;
    method?: string;
    params?: string[];
    body?: string | string[] | Record<string, any>;
    connectionId?: string;
    orchestrationId?: string;
    dataSchema?: Record<string, any>;
    data?: any;
  },
): Promise<ToolOutput> {
  try {
    const action = handlerConfig.action || "api-call";

    switch (action) {
      case "api-call": {
        // Ensure required properties for api-call action
        if (!handlerConfig.path || !handlerConfig.method) {
          throw new Error(
            "Missing required properties for api-call action: path and method",
          );
        }

        return await handleApiCallAction(args, context, {
          path: handlerConfig.path,
          method: handlerConfig.method,
          params: handlerConfig.params,
          body: handlerConfig.body,
        });
      }

      case "use-connection":
        return await handleUseConnectionAction(args, context, {
          connectionId: handlerConfig.connectionId,
        });

      case "use-orchestration":
        return await handleUseOrchestrationAction(args, context, {
          orchestrationId: handlerConfig.orchestrationId,
          dataSchema: handlerConfig.dataSchema,
        });

      case "trigger-orchestration":
        return await handleTriggerOrchestrationAction(args, context, {
          orchestrationId: handlerConfig.orchestrationId,
          data: handlerConfig.data,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error(`DLX handler error: ${error}`);
    throw error;
  }
}
