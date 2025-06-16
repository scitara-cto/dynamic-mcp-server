import { PromptOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";

export async function handleDeletePromptAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<PromptOutput> {
  try {
    const { promptName } = args;
    
    if (!promptName) {
      throw new Error("promptName argument is required");
    }

    let confirmationMessage = "# Prompt Deletion Confirmation\n\n";
    confirmationMessage += `You are about to delete the prompt: **${promptName}**\n\n`;
    
    confirmationMessage += "## ⚠️ Warning\n\n";
    confirmationMessage += "This action cannot be undone. Deleting this prompt will:\n\n";
    confirmationMessage += "- Remove the prompt from your available prompts list\n";
    confirmationMessage += "- Make it unavailable for future use\n";
    confirmationMessage += "- Potentially break any workflows that depend on this prompt\n\n";
    
    confirmationMessage += "## Before You Delete\n\n";
    confirmationMessage += "Please consider:\n\n";
    confirmationMessage += "1. **Backup**: Do you have a backup of this prompt's configuration?\n";
    confirmationMessage += "2. **Dependencies**: Are there any tools or workflows that use this prompt?\n";
    confirmationMessage += "3. **Alternatives**: Could you modify the prompt instead of deleting it?\n";
    confirmationMessage += "4. **Permissions**: Do other users rely on this prompt?\n\n";
    
    confirmationMessage += "## How to Proceed\n\n";
    confirmationMessage += "If you're certain you want to delete this prompt:\n\n";
    confirmationMessage += "1. Use the appropriate tool management interface\n";
    confirmationMessage += "2. Or contact your system administrator\n";
    confirmationMessage += "3. Ensure you have proper permissions to delete prompts\n\n";
    
    confirmationMessage += "## Alternative Actions\n\n";
    confirmationMessage += "Instead of deleting, you might consider:\n\n";
    confirmationMessage += "- **Disable**: Temporarily hide the prompt by modifying its visibility\n";
    confirmationMessage += "- **Update**: Modify the prompt to better suit your needs\n";
    confirmationMessage += "- **Archive**: Move the prompt to an archived state for future reference\n\n";
    
    confirmationMessage += `**Prompt to delete:** \`${promptName}\`\n\n`;
    confirmationMessage += "*Please proceed with caution.*";

    return {
      description: `Confirmation message for deleting prompt: ${promptName}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I want to delete the prompt "${promptName}". Can you confirm this action?`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: confirmationMessage,
          },
        },
      ],
    };
  } catch (error) {
    logger.error("Error in handleDeletePromptAction:", error);
    throw error;
  }
}