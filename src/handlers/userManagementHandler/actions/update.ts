import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";

const userRepository = new UserRepository();

export async function handleUpdateUserAction(
  args: Record<string, any>,
  _context: any,
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
