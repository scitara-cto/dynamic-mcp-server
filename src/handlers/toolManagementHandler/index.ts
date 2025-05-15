import logger from "../../utils/logger.js";
import { ToolOutput } from "../../mcp/types.js";
import { toolManagementTools } from "./tools.js";
import { HandlerFunction, HandlerPackage } from "../../mcp/types.js";

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

async function handleDeleteToolAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string; tool?: string[] },
): Promise<ToolOutput> {
  const mcpServer = context.mcpServer;
  if (!mcpServer) {
    throw new Error("McpServer not available in context");
  }
  const toolService = mcpServer.toolService;
  const toolName = args.name as string;
  if (!toolName) {
    throw new Error("Tool name is required for deletion");
  }
  // Remove tool directly; if not found, handle error in removeTool
  await toolService.removeTool(toolName); // Will throw if not found
  await mcpServer.notifyToolListChanged();
  return {
    result: { success: true, name: toolName },
    message: `Tool '${toolName}' deleted successfully`,
  };
}

async function handleListToolsAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string; tool?: string[] },
): Promise<ToolOutput> {
  const mcpServer = context.mcpServer;
  if (!mcpServer) {
    throw new Error("McpServer not available in context");
  }
  const user = context.user;
  if (!user) {
    throw new Error("User context is required to list tools");
  }
  const toolRepo = new (
    await import("../../db/repositories/ToolRepository.js")
  ).ToolRepository();
  const allTools = await toolRepo.findAll();
  const userRoles = user.roles || [];
  const sharedToolNames = (user.sharedTools || []).map((t: any) => t.toolId);
  const usedTools = user.usedTools || [];
  const nameContains = args.nameContains?.toLowerCase() || "";
  const filteredTools = allTools
    .filter(
      (tool) => !nameContains || tool.name.toLowerCase().includes(nameContains),
    )
    .map((tool) => {
      const available =
        (tool.rolesPermitted &&
          tool.rolesPermitted.some((role: string) =>
            userRoles.includes(role),
          )) ||
        sharedToolNames.includes(tool.name) ||
        tool.creator === user.email ||
        tool.creator === "system";
      const inUse = usedTools.includes(tool.name);
      return {
        name: tool.name,
        description: tool.description,
        available,
        inUse,
      };
    });
  // Split tools into available and in-use arrays
  const availableTools = filteredTools.filter((t) => t.available);
  const inUseTools = filteredTools.filter((t) => t.inUse);
  return {
    result: {
      availableTools,
      inUseTools,
      total: filteredTools.length,
      filtered: !!nameContains,
    },
    message:
      "Tools are grouped into those available to you and those currently in use. To use a tool, add it to your in-use list.",
    nextSteps: [
      "To start using an available tool, call the 'update-usedTools' tool (from user management) with the tool's name to add it to your in-use list.",
      "You can only use tools that are in your in-use list.",
      "To stop using a tool, remove it from your in-use list via user management.",
    ],
  };
}

async function handleAddToolAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string; tool?: string[] },
): Promise<ToolOutput> {
  const mcpServer = context.mcpServer;
  if (!mcpServer) {
    throw new Error("McpServer not available in context");
  }
  const toolService = mcpServer.toolService;
  const user = context.user;
  if (!user || !user.email) {
    throw new Error("User context with email is required to add a tool");
  }
  const toolDef = args.toolDefinition;
  if (!toolDef || typeof toolDef !== "object" || !toolDef.name) {
    throw new Error("A valid toolDefinition object with a name is required");
  }
  // Persist the tool
  await toolService.addTool(toolDef, user.email);
  // Notify all sessions
  await mcpServer.notifyToolListChanged();
  return {
    result: { success: true, name: toolDef.name },
    message: `Tool '${toolDef.name}' added successfully`,
    nextSteps: [
      `To start using '${toolDef.name}', call the 'update-usedTools' tool (from user management) with this tool's name to add it to your in-use list.`,
    ],
  };
}

export const toolManagementHandlerPackage: HandlerPackage = {
  name: "tool-management",
  handler,
  tools: toolManagementTools,
};
