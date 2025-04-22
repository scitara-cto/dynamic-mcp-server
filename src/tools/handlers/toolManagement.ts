import { SessionInfo } from "../../mcp/server.js";
import { ToolOutput } from "../types.js";
import logger from "../../utils/logger.js";
import { ToolDefinition } from "../tools.js";

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

    // Get the mcpServer from the context
    const mcpServer = context.mcpServer;

    if (!mcpServer) {
      throw new Error("McpServer not available in context");
    }

    // Access the toolGenerator directly from the mcpServer
    const toolGenerator = mcpServer.toolGenerator;

    switch (action) {
      case "add": {
        // Extract tool properties from args
        const toolProperties = handlerConfig.tool || [];
        const toolData: Partial<ToolDefinition> = {};

        for (const prop of toolProperties) {
          if (args[prop] !== undefined) {
            toolData[prop as keyof ToolDefinition] = args[prop];
          } else {
            throw new Error(`Missing required tool property: ${prop}`);
          }
        }

        // Validate required properties
        if (!toolData.name) {
          throw new Error("Tool name is required");
        }

        // Check if tool already exists
        if (toolGenerator.getTool(toolData.name)) {
          throw new Error(`Tool with name '${toolData.name}' already exists`);
        }

        // Register the new tool
        await toolGenerator.registerTool(toolData as ToolDefinition);

        return {
          result: { success: true, name: toolData.name },
          message: `Tool '${toolData.name}' added successfully`,
        };
      }

      case "delete": {
        const toolName = args.name;
        if (!toolName) {
          throw new Error("Tool name is required for deletion");
        }

        // Check if tool exists
        const tool = toolGenerator.getTool(toolName);
        if (!tool) {
          throw new Error(`Tool with name '${toolName}' not found`);
        }

        // Remove the tool from the tools map
        await toolGenerator.removeTool(toolName);

        return {
          result: { success: true, name: toolName },
          message: `Tool '${toolName}' deleted successfully`,
        };
      }

      case "list": {
        const tools = toolGenerator.getRegisteredToolNames();

        // Filter tools by name if nameContains is provided
        let filteredTools = tools;
        if (args.nameContains) {
          filteredTools = tools.filter((name) =>
            name.toLowerCase().includes(args.nameContains.toLowerCase()),
          );
        }

        return {
          result: {
            tools: filteredTools,
            total: filteredTools.length,
            filtered: args.nameContains ? true : false,
          },
          message: `Found ${filteredTools.length} tools${
            args.nameContains ? ` matching "${args.nameContains}"` : ""
          }`,
        };
      }

      case "replace": {
        const toolName = args.name;
        if (!toolName) {
          throw new Error("Tool name is required for replacement");
        }

        // Check if tool exists
        const existingTool = toolGenerator.getTool(toolName);
        if (!existingTool) {
          throw new Error(`Tool with name '${toolName}' not found`);
        }

        // Extract tool properties from args
        const toolProperties = handlerConfig.tool || [];
        const toolData: Partial<ToolDefinition> = { name: toolName };

        for (const prop of toolProperties) {
          if (args[prop] !== undefined) {
            toolData[prop as keyof ToolDefinition] = args[prop];
          }
        }

        // Remove the existing tool
        await toolGenerator.removeTool(toolName);

        // Register the new tool
        await toolGenerator.registerTool(toolData as ToolDefinition);

        return {
          result: { success: true, name: toolName },
          message: `Tool '${toolName}' replaced successfully`,
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error(`Tool Management handler error: ${error}`);
    throw error;
  }
}
