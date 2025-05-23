import { ToolOutput } from "../../../mcp/types.js";

export async function handleDeleteToolAction(
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
  await toolService.removeTool(toolName);
  await mcpServer.notifyToolListChanged();
  return {
    result: { success: true, name: toolName },
    message: `Tool '${toolName}' deleted successfully`,
  };
}
