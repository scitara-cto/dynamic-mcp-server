import logger from "../../utils/logger.js";
import { ToolOutput } from "../../mcp/types.js";
import { userManagementTools } from "./tools.js";
import { HandlerFunction, HandlerPackage } from "../../mcp/types.js";
import { handleListUsersAction } from "./actions/list.js";
import { handleAddUserAction } from "./actions/add.js";
import { handleUpdateUserAction } from "./actions/update.js";
import { handleDeleteUserAction } from "./actions/delete.js";
import { handleResetApiKeyAction } from "./actions/resetApiKey.js";
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
  "reset-api-key": handleResetApiKeyAction,
  "share-tool": handleShareToolAction,
  "unshare-tool": handleUnshareToolAction,
  "user-info": handleUserInfoAction,
  "hide-tool": handleHideToolAction,
  "unhide-tool": handleUnhideToolAction,
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

async function handleHideToolAction(
  args: Record<string, any>,
  context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const user = context.user;
  if (!user || !user.email) {
    throw new Error("User context with email is required to hide a tool");
  }
  let { toolId } = args;
  if (!toolId || (typeof toolId !== "string" && !Array.isArray(toolId))) {
    throw new Error("toolId must be a string or array of strings");
  }
  const toolIds = Array.isArray(toolId) ? toolId : [toolId];
  const updatedUser = await userRepository.addHiddenTools(user.email, toolIds);
  return {
    result: { success: true, hiddenTools: updatedUser?.hiddenTools },
    message: `Tool(s) '${toolIds.join(
      ", ",
    )}' have been hidden for your account`,
  };
}

async function handleUnhideToolAction(
  args: Record<string, any>,
  context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const user = context.user;
  if (!user || !user.email) {
    throw new Error("User context with email is required to unhide a tool");
  }
  let { toolId } = args;
  if (!toolId || (typeof toolId !== "string" && !Array.isArray(toolId))) {
    throw new Error("toolId must be a string or array of strings");
  }
  const toolIds = Array.isArray(toolId) ? toolId : [toolId];
  const updatedUser = await userRepository.removeHiddenTools(
    user.email,
    toolIds,
  );
  return {
    result: { success: true, hiddenTools: updatedUser?.hiddenTools },
    message: `Tool(s) '${toolIds.join(
      ", ",
    )}' have been unhidden for your account`,
  };
}

export const userManagementHandlerPackage: HandlerPackage = {
  name: "user-management",
  tools: userManagementTools,
  handler,
  testScript: new URL("./test-script.md", import.meta.url).pathname,
};
