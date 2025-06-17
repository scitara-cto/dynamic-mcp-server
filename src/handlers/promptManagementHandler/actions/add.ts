import { ToolOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";
import { PromptRepository } from "../../../db/repositories/PromptRepository.js";

export async function handleAddPromptAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<ToolOutput> {
  try {
    const {
      name,
      description,
      arguments: promptArguments,
      handler,
      rolesPermitted = ["user"],
      alwaysVisible = false
    } = args;

    if (!name) {
      return {
        result: {
          success: false,
          error: "Prompt name is required"
        }
      };
    }

    if (!description) {
      return {
        result: {
          success: false,
          error: "Prompt description is required"
        }
      };
    }

    if (!handler || !handler.type) {
      return {
        result: {
          success: false,
          error: "Handler configuration is required (must include type)"
        }
      };
    }

    const promptRepository = new PromptRepository();
    const userEmail = context.user?.email || "system";
    
    // Check if prompt already exists
    const existingPrompt = await promptRepository.getPromptForUser(userEmail, name);
    if (existingPrompt) {
      return {
        result: {
          success: false,
          error: `Prompt with name "${name}" already exists`
        }
      };
    }

    // Create the prompt
    const promptData = {
      name,
      description,
      arguments: promptArguments || [],
      handler,
      rolesPermitted,
      alwaysVisible
    };

    await promptRepository.addPrompt(promptData, userEmail);

    return {
      result: {
        success: true,
        prompt: {
          name,
          description,
          arguments: promptArguments || [],
          handler,
          rolesPermitted,
          alwaysVisible,
          createdBy: userEmail
        }
      }
    };
  } catch (error) {
    logger.error("Error in handleAddPromptAction:", error);
    throw error;
  }
}