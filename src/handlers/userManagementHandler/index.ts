import logger from "../../utils/logger.js";
import { ToolOutput } from "../../mcp/types.js";
import { userManagementTools } from "./tools.js";
import { Handler } from "../../mcp/server.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";

export class UserManagementHandler implements Handler {
  name = "user-management";
  tools = userManagementTools;
  private userRepository: UserRepository;

  private actionHandlers: Record<
    string,
    (
      args: Record<string, any>,
      context: any,
      handlerConfig: { action: string },
    ) => Promise<ToolOutput>
  >;

  constructor() {
    this.userRepository = new UserRepository();
    this.actionHandlers = {
      "list": this.handleListUsersAction.bind(this),
      "add": this.handleAddUserAction.bind(this),
      "update": this.handleUpdateUserAction.bind(this),
      "delete": this.handleDeleteUserAction.bind(this),
      "share-tool": this.handleShareToolAction.bind(this),
      "unshare-tool": this.handleUnshareToolAction.bind(this),
      "update-usedTools": this.handleUpdateUsedToolsAction.bind(this),
    };
  }

  handler = async (
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string },
  ) => {
    try {
      const action = handlerConfig.action;
      const fn = this.actionHandlers[action];
      if (!fn) {
        throw new Error(`Unknown action: ${action}`);
      }
      return await fn(args, context, handlerConfig);
    } catch (error) {
      logger.error(`User Management handler error: ${error}`);
      throw error;
    }
  };

  private async handleListUsersAction(
    args: Record<string, any>,
    _context: any,
    _handlerConfig: { action: string },
  ): Promise<ToolOutput> {
    const { nameContains, skip, limit } = args;
    const users = await this.userRepository.list({ nameContains, skip, limit });
    return {
      result: { users, total: users.length },
      message:
        `Found ${users.length} users` +
        (nameContains ? ` matching "${nameContains}"` : ""),
    };
  }

  private async handleAddUserAction(
    args: Record<string, any>,
    _context: any,
    _handlerConfig: { action: string },
  ): Promise<ToolOutput> {
    const { email, name, roles } = args;
    if (!email) throw new Error("Email is required");
    const user = await this.userRepository.create({ email, name, roles });
    return {
      result: user,
      message: `User '${email}' added successfully`,
    };
  }

  private async handleUpdateUserAction(
    args: Record<string, any>,
    _context: any,
    _handlerConfig: { action: string },
  ): Promise<ToolOutput> {
    const { email, ...updates } = args;
    if (!email) throw new Error("Email is required");
    const user = await this.userRepository.updateUser(email, updates);
    if (!user) throw new Error(`User '${email}' not found`);
    return {
      result: user,
      message: `User '${email}' updated successfully`,
    };
  }

  private async handleDeleteUserAction(
    args: Record<string, any>,
    _context: any,
    _handlerConfig: { action: string },
  ): Promise<ToolOutput> {
    const { email } = args;
    if (!email) throw new Error("Email is required");
    const deleted = await this.userRepository.removeUser(email);
    return {
      result: { success: deleted, email },
      message: deleted
        ? `User '${email}' deleted successfully`
        : `User '${email}' not found or not deleted`,
    };
  }

  private async updateUserToolShareState(
    action: "share" | "unshare",
    email: string,
    toolId: string,
    sharedBy: string,
    accessLevel?: string,
    mcpServer?: any,
  ): Promise<ToolOutput> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new Error(`User '${email}' not found`);
    let filtered = (user.sharedTools || []).filter(
      (t: any) => !(t.toolId === toolId && t.sharedBy === sharedBy),
    );
    let message = "";
    if (action === "share") {
      const shareEntry: any = {
        toolId,
        sharedBy,
        sharedAt: new Date(),
      };
      if (accessLevel) {
        shareEntry.accessLevel = accessLevel;
      }
      filtered.push(shareEntry);
      message = `Tool '${toolId}' shared with '${email}' as '${accessLevel}' by '${sharedBy}'`;
    } else {
      message = `Tool '${toolId}' unshared from '${email}' by '${sharedBy}'`;
    }
    const updated = await this.userRepository.updateUser(email, {
      sharedTools: filtered,
    });
    if (mcpServer?.notifyToolListChanged) {
      await mcpServer.notifyToolListChanged(email);
    }
    return {
      result: updated,
      message,
    };
  }

  private async handleShareToolAction(
    args: Record<string, any>,
    context: any,
    _handlerConfig: { action: string },
  ): Promise<ToolOutput> {
    const { email, toolId, accessLevel } = args;
    if (!email || !toolId || !accessLevel)
      throw new Error("email, toolId, and accessLevel are required");
    const sharedBy = context?.user?.email || "system";
    return this.updateUserToolShareState(
      "share",
      email,
      toolId,
      sharedBy,
      accessLevel,
      context?.mcpServer,
    );
  }

  private async handleUnshareToolAction(
    args: Record<string, any>,
    context: any,
    _handlerConfig: { action: string },
  ): Promise<ToolOutput> {
    const { email, toolId } = args;
    if (!email || !toolId) throw new Error("email and toolId are required");
    const sharedBy = context?.user?.email || "system";
    return this.updateUserToolShareState(
      "unshare",
      email,
      toolId,
      sharedBy,
      undefined,
      context?.mcpServer,
    );
  }

  private async handleUpdateUsedToolsAction(
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string },
  ): Promise<ToolOutput> {
    const user = context.user;
    if (!user || !user.email) {
      throw new Error(
        "User context with email is required to update used tools",
      );
    }
    const { operation, toolId } = args;
    if (!toolId || typeof toolId !== "string") {
      throw new Error("toolId must be a non-empty string");
    }
    if (operation !== "add" && operation !== "remove") {
      throw new Error("operation must be 'add' or 'remove'");
    }
    let updatedUser;
    if (operation === "add") {
      updatedUser = await this.userRepository.addUsedTools(user.email, [
        toolId,
      ]);
    } else {
      if (!this.userRepository.removeUsedTools) {
        throw new Error(
          "removeUsedTools method not implemented in UserRepository",
        );
      }
      updatedUser = await this.userRepository.removeUsedTools(user.email, [
        toolId,
      ]);
    }
    return {
      result: { success: true, usedTools: updatedUser?.usedTools },
      message: `Tool '${toolId}' has been ${
        operation === "add" ? "added to" : "removed from"
      } your used tools list`,
    };
  }
}

export const userManagementHandlerPackage = {
  name: "user-management",
  handler: new UserManagementHandler(),
  tools: userManagementTools,
};
