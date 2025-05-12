import logger from "../../utils/logger.js";
import { ToolOutput } from "../../mcp/types.js";
import { toolManagementTools } from "./tools.js";
import { Handler } from "../../mcp/server.js";

export class ToolManagementHandler implements Handler {
  name = "tool-management";
  tools = toolManagementTools;

  private actionHandlers: Record<
    string,
    (
      args: Record<string, any>,
      context: any,
      handlerConfig: { action: string; tool?: string[] },
    ) => Promise<ToolOutput>
  >;

  constructor() {
    this.actionHandlers = {
      delete: this.handleDeleteToolAction.bind(this),
      list: this.handleListToolsAction.bind(this),
      add: this.handleAddToolAction.bind(this),
    };
  }

  handler = async (
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string; tool?: string[] },
  ) => {
    try {
      const action = handlerConfig.action;
      const fn = this.actionHandlers[action];
      if (!fn) {
        throw new Error(`Unknown action: ${action}`);
      }
      return await fn(args, context, handlerConfig);
    } catch (error) {
      logger.error(`Tool Management handler error: ${error}`);
      throw error;
    }
  };

  private async handleDeleteToolAction(
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string; tool?: string[] },
  ): Promise<ToolOutput> {
    const mcpServer = context.mcpServer;
    if (!mcpServer) {
      throw new Error("McpServer not available in context");
    }
    const toolGenerator = mcpServer.toolGenerator;
    const toolName = args.name as string;
    if (!toolName) {
      throw new Error("Tool name is required for deletion");
    }
    const tool = toolGenerator.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool with name '${toolName}' not found`);
    }
    await toolGenerator.removeTool(toolName);
    await mcpServer.notifyToolListChanged();
    return {
      result: { success: true, name: toolName },
      message: `Tool '${toolName}' deleted successfully`,
    };
  }

  private async handleListToolsAction(
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string; tool?: string[] },
  ): Promise<ToolOutput> {
    const mcpServer = context.mcpServer;
    if (!mcpServer) {
      throw new Error("McpServer not available in context");
    }
    const toolGenerator = mcpServer.toolGenerator;
    const nameContains = args.nameContains?.toLowerCase() || "";
    const tools = Array.from(
      toolGenerator.getRegisteredToolNames(),
    ) as string[];
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

  private async handleAddToolAction(
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string; tool?: string[] },
  ): Promise<ToolOutput> {
    const mcpServer = context.mcpServer;
    if (!mcpServer) {
      throw new Error("McpServer not available in context");
    }
    const toolGenerator = mcpServer.toolGenerator;
    const user = context.user;
    if (!user || !user.email) {
      throw new Error("User context with email is required to add a tool");
    }
    const toolDef = args.toolDefinition;
    if (!toolDef || typeof toolDef !== "object" || !toolDef.name) {
      throw new Error("A valid toolDefinition object with a name is required");
    }
    // Persist the tool
    await toolGenerator.addTool(toolDef, user.email);
    // Register the tool in memory for this session
    await toolGenerator.publishTool(toolDef);
    // Notify all sessions
    await mcpServer.notifyToolListChanged();
    return {
      result: { success: true, name: toolDef.name },
      message: `Tool '${toolDef.name}' added successfully`,
    };
  }
}
