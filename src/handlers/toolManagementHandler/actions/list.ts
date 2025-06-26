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
  const visibleTools = filteredTools
    .filter((t: any) => !t.hidden)
    .map((t: any) => ({
      name: t.name,
      description: t.description,
      hidden: t.hidden,
      alwaysVisible: t.alwaysVisible,
    }));
  const hiddenToolNames = filteredTools
    .filter((t: any) => t.hidden)
    .map((t: any) => t.name);

  // Check for tools with duplicate base names
  const baseNameCounts = new Map<string, string[]>();
  filteredTools.forEach((tool: any) => {
    // Extract base name from namespacedName (e.g., "user-management:list-users" -> "list-users")
    const baseName = tool.namespacedName ? tool.namespacedName.split(':')[1] || tool.name : tool.name;
    if (!baseNameCounts.has(baseName)) {
      baseNameCounts.set(baseName, []);
    }
    baseNameCounts.get(baseName)!.push(tool.namespacedName || tool.name);
  });

  const duplicateBaseNames = Array.from(baseNameCounts.entries())
    .filter(([_, namespacedNames]) => namespacedNames.length > 1)
    .map(([baseName, namespacedNames]) => ({ baseName, namespacedNames }));

  let message = hiddenToolNames.length > 0
    ? `The following tools are currently hidden: ${hiddenToolNames.join(
        ", ",
      )}. Use the hideTool/unHideTool actions to hide or unhide tools.`
    : "No tools are currently hidden. Use the hideTool/unHideTool actions to hide or unhide tools.";

  // Add warning about duplicate base names
  if (duplicateBaseNames.length > 0) {
    const duplicateWarnings = duplicateBaseNames.map(({ baseName, namespacedNames }) =>
      `"${baseName}" (${namespacedNames.join(', ')})`
    ).join('; ');
    message += `\n\n⚠️  WARNING: You have tools with duplicate base names: ${duplicateWarnings}. When executing tools, the system will prioritize your own tools over shared tools, and shared tools over built-in tools.`;
  }

  return {
    result: {
      visibleTools,
      total: filteredTools.length,
      filtered: !!nameContains,
      hiddenTools: hiddenToolNames,
      duplicateBaseNames: duplicateBaseNames.length > 0 ? duplicateBaseNames : undefined,
    },
    message,
    nextSteps: [
      "To hide a tool, use the 'hideTool' action (to be implemented).",
      "To unhide a tool, use the 'unHideTool' action (to be implemented).",
    ],
  };
}
