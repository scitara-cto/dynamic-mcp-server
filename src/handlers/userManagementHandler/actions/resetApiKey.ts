import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { randomUUID } from "crypto";
import { canActOnUser } from "../authz.js";

const userRepository = new UserRepository();

export async function handleResetApiKeyAction(
  args: Record<string, any>,
  context: any,
): Promise<ToolOutput> {
  // Stateless confirmation logic
  if (!args.userConfirmed) {
    return {
      result: null,
      message:
        "Are you sure you want to reset your API key? This will invalidate your current key and require you to update all clients. Please confirm before proceeding. Always call this tool first with userConfirmed: false (or omitted). Only set userConfirmed: true after the user has explicitly confirmed.",
      nextSteps: [
        "Ask the user to confirm they want to reset their API key.",
        "If confirmed, call this tool again with userConfirmed: true.",
      ],
    };
  }

  const sessionUser = context.user;
  const requestedEmail = args.email;
  const targetEmail =
    sessionUser?.roles?.includes("admin") && requestedEmail
      ? requestedEmail
      : sessionUser?.email;

  if (!canActOnUser(sessionUser, targetEmail)) {
    throw new Error("Not authorized to reset this user's API key");
  }

  if (!targetEmail) throw new Error("No user email found in session context");

  // Generate a new API key and update the user
  const newApiKey = randomUUID();
  const user = await userRepository.updateUser(targetEmail, {
    apiKey: newApiKey,
  });
  if (!user) throw new Error(`User '${targetEmail}' not found`);

  // Send connection instructions email with a custom message
  const customMessage = `Your API key has been reset. Here is your new API key.\n\nAll MCP clients using this server must now be reconfigured to use the new API key.`;
  try {
    await userRepository.sendConnectionInstructionsEmail(user, customMessage);
  } catch (err) {
    // Log but do not block
    // eslint-disable-next-line no-console
    console.error(`Failed to send API key reset email to ${user.email}:`, err);
  }

  return {
    result: user,
    message:
      `API key for user '${targetEmail}' has been reset and emailed to the user.\n` +
      `All MCP clients using this server must now be reconfigured to use the new API key.`,
  };
}
