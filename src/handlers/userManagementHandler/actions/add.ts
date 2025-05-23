import { ToolOutput } from "../../../mcp/types.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { EmailService } from "../../../services/EmailService.js";
import { config } from "../../../config/index.js";

const userRepository = new UserRepository();

export async function handleAddUserAction(
  args: Record<string, any>,
  _context: any,
  _handlerConfig: { action: string },
): Promise<ToolOutput> {
  const { email, name, roles } = args;
  if (!email) throw new Error("Email is required");
  const user = await userRepository.create({ email, name, roles });

  // Send onboarding email
  const mcpName = config.server.mcpName;
  const subject = `Welcome to ${mcpName}`;
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
    ? `please contact your administrator at <a href="mailto:${adminEmail}">${adminEmail}</a>.`
    : "please contact your administrator.";
  const html = `
    <h2>Welcome to ${mcpName}</h2>
    <p>Hello${name ? ` ${name}` : ""},</p>
    <p>Your account has been created on <strong>${mcpName}</strong>. Here are your credentials and instructions to get started:</p>
    <ul>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>API Key:</strong> ${user.apiKey}</li>
    </ul>
    <p>To connect an MCP client, configure it with the following:</p>
    <ul>
      <li><strong>Server URL:</strong> <code>${serverUrl}</code></li>
      <li><strong>Email:</strong> <code>${user.email}</code></li>
      <li><strong>API Key:</strong> <code>${user.apiKey}</code></li>
    </ul>
    <p>Typical MCP client configuration:</p>
    <pre><code>${clientConfig}</code></pre>
    <p>If you have any questions, ${contactLine}</p>
    <p>Thank you!</p>
  `;
  try {
    await EmailService.sendEmail({ to: user.email, subject, html });
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
