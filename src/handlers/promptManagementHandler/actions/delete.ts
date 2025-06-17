import { ToolOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";
import { PromptRepository } from "../../../db/repositories/PromptRepository.js";

export async function handleDeletePromptAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<ToolOutput> {
  try {
    const { name } = args;
    
    if (!name) {
      return {
        result: {
          success: false,
          error: "Prompt name is required"
        }
      };
    }

    const promptRepository = new PromptRepository();
    const userEmail = context.user?.email || "system";
    
    // Check if prompt exists and user has permission to delete it
    const existingPrompt = await promptRepository.getPromptForUser(userEmail, name);
    if (!existingPrompt) {
      return {
        result: {
          success: false,
          error: `Prompt with name "${name}" not found or you don't have permission to delete it`
        }
      };
    }

    // Delete the prompt
    await promptRepository.removePrompt(name, userEmail);

    return {
      result: {
        success: true,
        message: `Prompt "${name}" has been successfully deleted`,
        deletedPrompt: {
          name: existingPrompt.name,
          description: existingPrompt.description
        }
      }
    };
  } catch (error) {
    logger.error("Error in handleDeletePromptAction:", error);
    throw error;
  }
}