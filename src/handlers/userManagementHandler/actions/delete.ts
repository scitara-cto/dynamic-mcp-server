import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";

const userRepository = new UserRepository();

export async function handleDeleteUserAction(
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
