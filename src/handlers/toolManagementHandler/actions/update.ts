import { ToolOutput } from "../../../mcp/types.js";

export async function handleUpdateToolAction(
  args: Record<string, any>,
  context: any,
): Promise<ToolOutput> {
  const mcpServer = context.mcpServer;
  if (!mcpServer) {
    throw new Error("McpServer not available in context");
  }
  const toolService = mcpServer.toolService;
  const user = context.user;
  if (!user || !user.email) {
    throw new Error("User context with email is required to update a tool");
  }
  const toolName = args.name;
  const updates = args.updates;
  if (!toolName || typeof toolName !== "string") {
    throw new Error("A valid tool name is required for update");
  }
  if (!updates || typeof updates !== "object") {
    throw new Error("A valid updates object is required");
  }
  const updatedTool = await toolService.updateTool(toolName, updates);
  await mcpServer.notifyToolListChanged();
  return {
    result: { success: !!updatedTool, name: toolName, updated: updatedTool },
    message: updatedTool
      ? `Tool '${toolName}' updated successfully`
      : `Tool '${toolName}' not found or not updated`,
  };
}
