import { SessionInfo } from "../../../mcp/server.js";
import { ToolOutput } from "../index.js";

export async function handleDeleteToolAction(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: { action: string; tool?: string[] },
): Promise<ToolOutput> {
  const mcpServer = context.mcpServer;
  if (!mcpServer) {
    throw new Error("McpServer not available in context");
  }
  const toolGenerator = mcpServer.toolGenerator;
  const toolName = args.name;
  if (!toolName) {
    throw new Error("Tool name is required for deletion");
  }
  const tool = toolGenerator.getTool(toolName);
  if (!tool) {
    throw new Error(`Tool with name '${toolName}' not found`);
  }
  await toolGenerator.removeTool(toolName);
  return {
    result: { success: true, name: toolName },
    message: `Tool '${toolName}' deleted successfully`,
  };
}
