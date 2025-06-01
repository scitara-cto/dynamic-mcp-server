import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { canActOnUser } from "../authz.js";

const userRepository = new UserRepository();

export async function handleUpdateUserAction(
  args: Record<string, any>,
  context: any,
): Promise<ToolOutput> {
  const { email, ...updates } = args;
  if (!email) throw new Error("Email is required");
  const sessionUser = context.user;
  if (!canActOnUser(sessionUser, email)) {
    throw new Error("Not authorized to update this user");
  }
  const isAdmin = sessionUser?.roles?.includes("admin");
  // Non-admins cannot update roles or other sensitive fields
  if (!isAdmin) {
    delete updates.roles;
    delete updates.sharedTools;
    // Add any other sensitive fields here
  }
  const user = await userRepository.updateUser(email, updates);
  if (!user) throw new Error(`User '${email}' not found`);
  return {
    result: user,
    message: `User '${email}' updated successfully`,
  };
}
