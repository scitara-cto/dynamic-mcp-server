import { ToolOutput } from "../../../mcp/types.js";

export async function handleListToolsAction(
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
    await import("../../../db/repositories/ToolRepository.js")
  ).ToolRepository();
  const allTools = await toolRepo.findAll();
  const userRoles = user.roles || [];
  const sharedToolNames = (user.sharedTools || []).map((t: any) => t.toolId);
  const hiddenTools = user.hiddenTools || [];
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
      const hidden = hiddenTools.includes(tool.name);
      return {
        name: tool.name,
        description: tool.description,
        available,
        hidden,
      };
    });
  // Only show available tools that are not hidden
  const visibleTools = filteredTools.filter((t) => t.available && !t.hidden);
  return {
    result: {
      visibleTools,
      total: filteredTools.length,
      filtered: !!nameContains,
    },
    message:
      "Tools are now all visible by default unless hidden. Use the hideTool/unHideTool actions to hide or unhide tools.",
    nextSteps: [
      "To hide a tool, use the 'hideTool' action (to be implemented).",
      "To unhide a tool, use the 'unHideTool' action (to be implemented).",
    ],
  };
}
