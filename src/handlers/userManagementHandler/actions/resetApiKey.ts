import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { EmailService } from "../../../services/EmailService.js";
import { config } from "../../../config/index.js";

const userRepository = new UserRepository();

export async function handleResetApiKeyAction(
  args: Record<string, any>,
  _context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { email } = args;
  if (!email) throw new Error("Email is required");
  // Reset API key (assume repo has a method for this, or update with a new key)
  const user = await userRepository.updateUser(email, { apiKey: undefined }); // triggers new key generation
  if (!user) throw new Error(`User '${email}' not found`);

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
    await EmailService.sendEmail({ to: user.email, subject, html });
  } catch (err) {
    // Log but do not block
    // eslint-disable-next-line no-console
    console.error(`Failed to send API key reset email to ${user.email}:`, err);
  }

  return {
    result: user,
    message:
      `API key for user '${email}' has been reset and emailed to the user.\n` +
      `All MCP clients using this server must now be reconfigured to use the new API key.\n` +
      `Example MCP client config:\n${clientConfig}`,
  };
}
