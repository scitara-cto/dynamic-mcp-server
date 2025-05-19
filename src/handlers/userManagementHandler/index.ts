import logger from "../../utils/logger.js";
import { ToolOutput } from "../../mcp/types.js";
import { userManagementTools } from "./tools.js";
import { HandlerFunction, HandlerPackage } from "../../mcp/types.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";

const userRepository = new UserRepository();
const actionHandlers: Record<
  string,
  (
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string },
  ) => Promise<ToolOutput>
> = {
  "list": handleListUsersAction,
  "add": handleAddUserAction,
  "update": handleUpdateUserAction,
  "delete": handleDeleteUserAction,
  "share-tool": handleShareToolAction,
  "unshare-tool": handleUnshareToolAction,
  "update-usedTools": handleUpdateUsedToolsAction,
  "user-info": handleUserInfoAction,
};

const handler: HandlerFunction = async (
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
) => {
  try {
    const action = handlerConfig.action;
    const fn = actionHandlers[action];
    if (!fn) {
      throw new Error(`Unknown action: ${action}`);
    }
    return await fn(args, context, handlerConfig);
  } catch (error) {
    logger.error(`User Management handler error: ${error}`);
    throw error;
  }
};

async function handleListUsersAction(
  args: Record<string, any>,
  _context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { nameContains, skip, limit } = args;
  const users = await userRepository.list({ nameContains, skip, limit });
  const minimalUsers = users.map((u: any) => ({
    email: u.email,
    name: u.name || null,
  }));
  return {
    result: { users: minimalUsers, total: minimalUsers.length },
    message:
      `Found ${minimalUsers.length} users` +
      (nameContains ? ` matching "${nameContains}"` : ""),
    nextSteps: [
      "To get more information about a specific user, use the 'user-info' tool with their email.",
    ],
  };
}

async function handleAddUserAction(
  args: Record<string, any>,
  _context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { email, name, roles } = args;
  if (!email) throw new Error("Email is required");
  const user = await userRepository.create({ email, name, roles });
  return {
    result: user,
    message: `User '${email}' added successfully`,
  };
}

async function handleUpdateUserAction(
  args: Record<string, any>,
  _context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { email, ...updates } = args;
  if (!email) throw new Error("Email is required");
  const user = await userRepository.updateUser(email, updates);
  if (!user) throw new Error(`User '${email}' not found`);
  return {
    result: user,
    message: `User '${email}' updated successfully`,
  };
}

async function handleDeleteUserAction(
  args: Record<string, any>,
  _context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { email } = args;
  if (!email) throw new Error("Email is required");
  const deleted = await userRepository.removeUser(email);
  return {
    result: { success: deleted, email },
    message: deleted
      ? `User '${email}' deleted successfully`
      : `User '${email}' not found or not deleted`,
  };
}

async function updateUserToolShareState(
  action: "share" | "unshare",
  email: string,
  toolId: string,
  sharedBy: string,
  accessLevel?: string,
  mcpServer?: any,
): Promise<ToolOutput> {
  const user = await userRepository.findByEmail(email);
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
  const updated = await userRepository.updateUser(email, {
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

async function handleShareToolAction(
  args: Record<string, any>,
  context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { email, toolId, accessLevel } = args;
  if (!email || !toolId || !accessLevel)
    throw new Error("email, toolId, and accessLevel are required");
  const sharedBy = context?.user?.email || "system";
  return updateUserToolShareState(
    "share",
    email,
    toolId,
    sharedBy,
    accessLevel,
    context?.mcpServer,
  );
}

async function handleUnshareToolAction(
  args: Record<string, any>,
  context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { email, toolId } = args;
  if (!email || !toolId) throw new Error("email and toolId are required");
  const sharedBy = context?.user?.email || "system";
  return updateUserToolShareState(
    "unshare",
    email,
    toolId,
    sharedBy,
    undefined,
    context?.mcpServer,
  );
}

async function handleUpdateUsedToolsAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<ToolOutput> {
  const user = context.user;
  if (!user || !user.email) {
    throw new Error("User context with email is required to update used tools");
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
    updatedUser = await userRepository.addUsedTools(user.email, [toolId]);
  } else {
    if (!userRepository.removeUsedTools) {
      throw new Error(
        "removeUsedTools method not implemented in UserRepository",
      );
    }
    updatedUser = await userRepository.removeUsedTools(user.email, [toolId]);
  }
  return {
    result: { success: true, usedTools: updatedUser?.usedTools },
    message: `Tool '${toolId}' has been ${
      operation === "add" ? "added to" : "removed from"
    } your used tools list`,
  };
}

async function handleUserInfoAction(
  args: Record<string, any>,
  context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const sessionUser = context.user;
  const requestedEmail = args.email || sessionUser.email;
  const isSelf = !args.email || args.email === sessionUser.email;
  const isAdmin = sessionUser.roles && sessionUser.roles.includes("admin");
  const user = await userRepository.findByEmail(requestedEmail);
  if (!user) {
    return {
      result: null,
      message: `User '${requestedEmail}' not found`,
    };
  }
  if (isSelf || isAdmin) {
    return {
      result: user,
      message: `User info for '${requestedEmail}'`,
    };
  } else {
    // Non-admin requesting info for another user: only return existence and name
    return {
      result: { exists: true, name: user.name || null, email: user.email },
      message: `Limited user info for '${requestedEmail}'`,
    };
  }
}

export const userManagementHandlerPackage: HandlerPackage = {
  name: "user-management",
  tools: userManagementTools,
  handler,
  testScript: new URL("./test-script.md", import.meta.url).pathname,
};
