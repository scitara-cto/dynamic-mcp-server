import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";

const userRepository = new UserRepository();

export async function handleAddUserAction(
  args: Record<string, any>,
  _context: any,
): Promise<ToolOutput> {
  const { email, name, roles } = args;
  if (!email) throw new Error("Email is required");
  const user = await userRepository.create({ email, name, roles });

  // Send onboarding email with connection instructions
  const customMessage = `Welcome${
    name ? ` ${name}` : ""
  }! Your account has been created. Here are your credentials and instructions to get started:`;
  try {
    await userRepository.sendConnectionInstructionsEmail(user, customMessage);
  } catch (err) {
    // Log but do not block user creation
    // eslint-disable-next-line no-console
    console.error(`Failed to send onboarding email to ${user.email}:`, err);
  }

  return {
    result: {
      email: user.email,
      name: user.name,
      roles: user.roles,
      apiKey: user.apiKey,
    },
    message: `User '${email}' added successfully`,
  };
}
