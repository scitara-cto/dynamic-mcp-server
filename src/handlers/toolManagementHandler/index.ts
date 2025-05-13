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
      "delete": this.handleDeleteToolAction.bind(this),
      "list": this.handleListToolsAction.bind(this),
      "add": this.handleAddToolAction.bind(this),
      "use-tools": this.handleUseToolsAction.bind(this),
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
        (tool) =>
          !nameContains || tool.name.toLowerCase().includes(nameContains),
      )
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        available:
          (tool.rolesPermitted &&
            tool.rolesPermitted.some((role: string) =>
              userRoles.includes(role),
            )) ||
          sharedToolNames.includes(tool.name) ||
          tool.creator === user.email ||
          tool.creator === "system",
        inUse: usedTools.includes(tool.name),
      }));
    return {
      result: {
        tools: filteredTools,
        total: filteredTools.length,
        filtered: !!nameContains,
      },
      message:
        "Tools marked as available: true are tools you are permitted to use. Tools marked as inUse: true are tools you have currently selected for use.",
      nextSteps: [
        "To start using an available tool, call the 'use-tools' tool with the tool's name to add it to your in-use list.",
      ],
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
      nextSteps: [
        `To start using '${toolDef.name}', call the 'use-tools' tool with this tool's name to add it to your in-use list.`,
      ],
    };
  }

  private async handleUseToolsAction(
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string; tool?: string[] },
  ): Promise<ToolOutput> {
    const user = context.user;
    if (!user || !user.email) {
      throw new Error("User context with email is required to use tools");
    }
    const toolIds = args.toolIds;
    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      throw new Error("toolIds must be a non-empty array");
    }
    const { UserRepository } = await import(
      "../../db/repositories/UserRepository.js"
    );
    const repo = new UserRepository();
    const updatedUser = await repo.addUsedTools(user.email, toolIds);
    return {
      result: { success: true, usedTools: updatedUser?.usedTools },
      message: `Added ${toolIds.length} tool(s) to usedTools`,
    };
  }
}
