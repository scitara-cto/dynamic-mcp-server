import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { ToolOutput } from "../index.js";
import type { SessionInfo } from "../../mcp/server.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Formats the tool output to match MCP server expectations
 * @param toolOutput The raw tool output
 * @returns Formatted output that matches MCP server expectations
 */
function formatToolOutput(toolOutput: ToolOutput): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          result: toolOutput.result,
          message: toolOutput.message,
          nextSteps: toolOutput.nextSteps,
        }),
      },
    ],
  };
}

/**
 * Creates a CallToolResult error response for MCP
 */
function createErrorResponse(error: unknown): CallToolResult {
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

function wrapHandler(
  handler: (
    args: Record<string, any>,
    context: SessionInfo,
    config: any,
  ) => Promise<ToolOutput>,
  config: any,
) {
  return async (
    args: Record<string, any>,
    context: SessionInfo,
  ): Promise<CallToolResult> => {
    try {
      const result = await handler(args, context, config);
      return formatToolOutput(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}

export async function discoverHandlers() {
  const handlersDir = path.resolve(__dirname);
  const handlerFactory: Record<string, (config: any) => any> = {};
  const allTools: any[] = [];

  const entries = await fs.readdir(handlersDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      let mod;
      try {
        mod = await import(path.join(handlersDir, entry.name, "index.js"));
      } catch (e) {
        mod = await import(path.join(handlersDir, entry.name, "index.ts"));
      }
      const handlerObj = mod.default || mod;
      if (handlerObj.handler && handlerObj.tools) {
        handlerFactory[entry.name] = (config: any) =>
          wrapHandler(handlerObj.handler, config);
        allTools.push(...handlerObj.tools);
      }
    }
  }
  return { handlerFactory, tools: allTools };
}
