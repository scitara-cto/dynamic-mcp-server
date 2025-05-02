import { DlxService } from "../../../services/DlxService.js";
import { SessionInfo } from "../../../mcp/server.js";
import logger from "../../../utils/logger.js";
import { ToolOutput } from "../../index.js";

/**
 * Handles the "api-call" action for the DLX handler
 * @param args The arguments passed to the tool
 * @param context The session context containing authentication information
 * @param handlerConfig The handler configuration from the tool definition
 * @returns A promise that resolves to the tool output
 */
export async function handleApiCallAction(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: {
    path: string;
    method: string;
    params?: string[];
    body?: string | string[] | Record<string, any>;
    successMessage?: string;
  },
): Promise<ToolOutput> {
  if (!handlerConfig.path || !handlerConfig.method) {
    throw new Error(
      "Missing required properties for api-call action: path and method",
    );
  }
  const dlxService = new DlxService();

  // Prepare the API call parameters
  const apiCallParams: {
    method: string;
    path: string;
    params?: Record<string, any>;
    data?: any;
  } = {
    method: handlerConfig.method,
    path: handlerConfig.path,
  };

  // Handle path parameters (e.g., {id})
  let path = handlerConfig.path;
  if (path.includes("{") && path.includes("}")) {
    const pathParams = path.match(/\{([^}]+)\}/g) || [];
    for (const param of pathParams) {
      const paramName = param.replace("{", "").replace("}", "");
      if (args[paramName]) {
        path = path.replace(param, args[paramName]);
      } else {
        throw new Error(`Missing required path parameter: ${paramName}`);
      }
    }
    apiCallParams.path = path;
  }

  // Handle query parameters
  if (handlerConfig.params && handlerConfig.params.length > 0) {
    apiCallParams.params = {};
    for (const param of handlerConfig.params) {
      if (args[param] !== undefined) {
        apiCallParams.params[param] = args[param];
      }
    }
  }

  // Handle request body
  if (handlerConfig.body) {
    if (Array.isArray(handlerConfig.body)) {
      // If body is an array of strings, merge all fields from args that are in this array
      apiCallParams.data = {};
      for (const field of handlerConfig.body) {
        if (args[field] !== undefined) {
          apiCallParams.data[field] = args[field];
        } else {
          throw new Error(`Missing required body parameter: ${field}`);
        }
      }
    } else if (typeof handlerConfig.body === "string") {
      // If body is a string, it's a reference to an argument
      if (args[handlerConfig.body] !== undefined) {
        apiCallParams.data = args[handlerConfig.body];
      } else {
        throw new Error(
          `Missing required body parameter: ${handlerConfig.body}`,
        );
      }
    } else {
      // If body is an object, use it directly
      apiCallParams.data = handlerConfig.body;
    }
  }

  logger.debug(`Executing DLX API call: ${JSON.stringify(apiCallParams)}`);

  // Execute the API call
  const response = await dlxService.executeDlxApiCall(apiCallParams, context);

  return {
    result: response,
    message: handlerConfig.successMessage || "Operation completed successfully",
  };
}
