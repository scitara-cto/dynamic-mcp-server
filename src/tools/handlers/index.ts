import { dlxHandler } from "./dlx/index.js";
import { toolManagementHandler } from "./toolManagement.js";
import { SessionInfo } from "../../mcp/server.js";
import { ToolOutput, McpToolResponse } from "../types.js";
import logger from "../../utils/logger.js";

/**
 * Formats the tool output to match MCP server expectations
 * @param toolOutput The raw tool output
 * @returns Formatted output that matches MCP server expectations
 */
function formatToolOutput(toolOutput: ToolOutput): McpToolResponse {
  const response: Record<string, unknown> = {
    result: toolOutput.result,
  };

  if (toolOutput.message) {
    response.message = toolOutput.message;
  }

  if (toolOutput.nextSteps) {
    response.nextSteps = toolOutput.nextSteps;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2),
      },
    ],
    isError: false,
  };
}

/**
 * Handler factory that creates the appropriate handler based on the tool's handler type
 * @param handlerType The type of handler to create
 * @returns A function that executes the handler with the given arguments and context
 */
export function createHandler(handlerType: string, handlerConfig: any) {
  switch (handlerType) {
    case "dlx":
      return async (
        args: Record<string, any>,
        context: SessionInfo,
      ): Promise<McpToolResponse> => {
        try {
          const result = await dlxHandler(args, context, handlerConfig);
          return formatToolOutput(result);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      };
    case "tool-management":
      return async (
        args: Record<string, any>,
        context: SessionInfo,
      ): Promise<McpToolResponse> => {
        try {
          const result = await toolManagementHandler(
            args,
            context,
            handlerConfig,
          );
          return formatToolOutput(result);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      };
    default:
      logger.error(`Unknown handler type: ${handlerType}`);
      throw new Error(`Unknown handler type: ${handlerType}`);
  }
}
