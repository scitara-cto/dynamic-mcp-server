import { PromptOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";

export async function handleListPromptsAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<PromptOutput> {
  try {
    const { sessionInfo } = context;
    const userEmail = sessionInfo?.user?.email;

    if (!userEmail) {
      throw new Error("User email not found in session context");
    }

    // Get prompts from the prompt service
    const prompts = await sessionInfo.mcpServer.promptService.getPromptsForUser(userEmail);

    // Generate a formatted list of prompts
    let promptList = "# Available Prompts\n\n";
    
    if (prompts.length === 0) {
      promptList += "No prompts are currently available for your user account.\n\n";
      promptList += "You can create new prompts using the prompt management tools or ask an administrator to add prompts for you.";
    } else {
      promptList += `Found ${prompts.length} prompt(s) available:\n\n`;
      
      for (const prompt of prompts) {
        promptList += `## ${prompt.name}\n`;
        if (prompt.description) {
          promptList += `**Description:** ${prompt.description}\n\n`;
        }
        
        if (prompt.arguments && prompt.arguments.length > 0) {
          promptList += "**Arguments:**\n";
          for (const arg of prompt.arguments) {
            const required = arg.required ? " (required)" : " (optional)";
            promptList += `- \`${arg.name}\`${required}`;
            if (arg.description) {
              promptList += `: ${arg.description}`;
            }
            promptList += "\n";
          }
          promptList += "\n";
        }
        
        promptList += `**Handler:** ${prompt.handler.type}\n\n`;
        promptList += "---\n\n";
      }
    }

    return {
      description: "List of available prompts for the current user",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Please list all available prompts for me.",
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: promptList,
          },
        },
      ],
    };
  } catch (error) {
    logger.error("Error in handleListPromptsAction:", error);
    throw error;
  }
}