import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";

const userRepository = new UserRepository();

export async function handleListUsersAction(
  args: Record<string, any>,
  _context: any,
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
