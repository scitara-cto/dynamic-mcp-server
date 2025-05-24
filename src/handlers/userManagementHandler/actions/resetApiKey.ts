import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { sendEmail } from "../../../services/EmailService.js";
import { config } from "../../../config/index.js";
import { randomUUID } from "crypto";

const userRepository = new UserRepository();

export async function handleResetApiKeyAction(
  args: Record<string, any>,
  context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  // Confirmation logic
  if (!args.userConfirmed) {
    return {
      result: null,
      message:
        "Are you sure you want to reset your API key? This will invalidate your current key and require you to update all clients. Please confirm before proceeding.",
      nextSteps: [
        "Ask the user to confirm they want to reset their API key.",
        "If confirmed, call this tool again with userConfirmed: true.",
      ],
    };
  }

  // Determine the email to use based on user role
  const sessionUser = context.user;
  const isAdmin = sessionUser?.roles?.includes("admin");
  let targetEmail: string;
  if (isAdmin && args.email) {
    targetEmail = args.email;
  } else {
    targetEmail = sessionUser?.email;
  }
  if (!targetEmail) throw new Error("No user email found in session context");

  // Generate a new API key and update the user
  const newApiKey = randomUUID();
  const user = await userRepository.updateUser(targetEmail, {
    apiKey: newApiKey,
  });
  if (!user) throw new Error(`User '${targetEmail}' not found`);

  // Prepare config and instructions
  const mcpName = config.server.mcpName;
  const serverUrl =
    config.server.url || "http(s)://<your-mcp-server-host>:<port>";
  const apiKey = user.apiKey;
  const clientConfig = `{
  "mcpServers": {
    "dlx": {
      "url": "${serverUrl.replace(/\/?$/, "/sse")}?apiKey=${apiKey}"
    }
  }
}`;
  const adminEmail = config.server.adminEmail;
  const contactLine = adminEmail
    ? `please contact your administrator at <a href=\"mailto:${adminEmail}\">${adminEmail}</a>.`
    : "please contact your administrator.";

  // Send email with new API key and instructions
  const subject = `Your API Key has been reset for ${mcpName}`;
  const html = `
    <h2>Your API Key has been reset for ${mcpName}</h2>
    <p>Hello${user.name ? ` ${user.name}` : ""},</p>
    <p>Your API key has been reset. Here is your new API key:</p>
    <ul>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>New API Key:</strong> ${user.apiKey}</li>
    </ul>
    <p><strong>Important:</strong> You must now reconfigure all MCP clients that use this server to use your new API key. Here is a typical MCP client configuration:</p>
    <pre><code>${clientConfig}</code></pre>
    <p>If you have any questions, ${contactLine}</p>
    <p>Thank you!</p>
  `;
  try {
    await sendEmail({ to: user.email, subject, html });
  } catch (err) {
    // Log but do not block
    // eslint-disable-next-line no-console
    console.error(`Failed to send API key reset email to ${user.email}:`, err);
  }

  return {
    result: user,
    message:
      `API key for user '${targetEmail}' has been reset and emailed to the user.\n` +
      `All MCP clients using this server must now be reconfigured to use the new API key.\n` +
      `Example MCP client config:\n${clientConfig}`,
  };
}
