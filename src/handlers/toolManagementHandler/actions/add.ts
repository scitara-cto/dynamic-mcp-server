import { ToolOutput } from "../../../mcp/types.js";

export async function handleAddToolAction(
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
