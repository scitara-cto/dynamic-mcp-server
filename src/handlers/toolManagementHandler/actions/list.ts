import { ToolOutput } from "../../../mcp/types.js";

export async function handleListToolsAction(
  args: Record<string, any>,
  context: any,
): Promise<ToolOutput> {
  const mcpServer = context.mcpServer;
  if (!mcpServer) {
    throw new Error("McpServer not available in context");
  }
  const user = context.user;
  if (!user) {
    throw new Error("User context is required to list tools");
  }
  const userRepo = new (
    await import("../../../db/repositories/UserRepository.js")
  ).UserRepository();
  const allUserTools = await userRepo.getUserTools(user.email);
  const nameContains = args.nameContains?.toLowerCase() || "";
  const filteredTools = nameContains
    ? allUserTools.filter((tool: any) =>
        tool.name.toLowerCase().includes(nameContains),
      )
    : allUserTools;
  const visibleTools = filteredTools.filter(
    (t: any) => t.available && !t.hidden,
  );
  const hiddenToolNames = filteredTools
    .filter((t: any) => t.hidden)
    .map((t: any) => t.name);
  return {
    result: {
      visibleTools,
      total: filteredTools.length,
      filtered: !!nameContains,
      hiddenTools: hiddenToolNames,
    },
    message:
      hiddenToolNames.length > 0
        ? `The following tools are currently hidden: ${hiddenToolNames.join(
            ", ",
          )}. Use the hideTool/unHideTool actions to hide or unhide tools.`
        : "No tools are currently hidden. Use the hideTool/unHideTool actions to hide or unhide tools.",
    nextSteps: [
      "To hide a tool, use the 'hideTool' action (to be implemented).",
      "To unhide a tool, use the 'unHideTool' action (to be implemented).",
    ],
  };
}
