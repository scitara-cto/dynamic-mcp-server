import { UserManagementHandler } from "./userManagementHandler/index.js";
import { ToolManagementHandler } from "./toolManagementHandler/index.js";
import { userManagementTools } from "./userManagementHandler/tools.js";
import { toolManagementTools } from "./toolManagementHandler/tools.js";

export const handlers = [
  new UserManagementHandler(),
  new ToolManagementHandler(),
];

export const builtInTools = [...userManagementTools, ...toolManagementTools];

export {
  UserManagementHandler,
  ToolManagementHandler,
  userManagementTools,
  toolManagementTools,
};
