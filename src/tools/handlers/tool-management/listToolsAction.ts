import { SessionInfo } from "../../../mcp/server.js";
import { ToolOutput } from "../../index.js";

export async function handleListToolsAction(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: { action: string; tool?: string[] },
): Promise<ToolOutput> {
  const mcpServer = context.mcpServer;
  if (!mcpServer) {
    throw new Error("McpServer not available in context");
  }
  const toolGenerator = mcpServer.toolGenerator;
  const nameContains = args.nameContains?.toLowerCase() || "";
  const tools = Array.from(toolGenerator.getRegisteredToolNames());
  const filtered = nameContains
    ? tools.filter((name) => name.toLowerCase().includes(nameContains))
    : tools;
  return {
    result: {
      tools: filtered,
      total: filtered.length,
      filtered: !!nameContains,
    },
    message: `Found ${filtered.length} tools${
      nameContains ? ` matching \"${nameContains}\"` : ""
    }`,
  };
}
