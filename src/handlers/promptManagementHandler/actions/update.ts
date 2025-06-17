import { ToolOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";
import { PromptRepository } from "../../../db/repositories/PromptRepository.js";

export async function handleUpdatePromptAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<ToolOutput> {
  try {
    const { name, updates } = args;
    
    if (!updates) {
      return {
        result: {
          success: false,
          error: "Updates object is required"
        }
      };
    }

    const {
      description,
      arguments: promptArguments,
      handler,
      rolesPermitted,
      alwaysVisible
    } = updates;

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
    
    // Check if prompt exists and user has permission to update it
    const existingPrompt = await promptRepository.getPromptForUser(userEmail, name);
    if (!existingPrompt) {
      return {
        result: {
          success: false,
          error: `Prompt with name "${name}" not found or you don't have permission to update it`
        }
      };
    }

    // Build update data - only include fields that were provided
    const updateData: any = {
      name,
      description: description || existingPrompt.description,
      arguments: promptArguments !== undefined ? promptArguments : existingPrompt.arguments,
      handler: handler || existingPrompt.handler,
      rolesPermitted: rolesPermitted !== undefined ? rolesPermitted : existingPrompt.rolesPermitted,
      alwaysVisible: alwaysVisible !== undefined ? alwaysVisible : existingPrompt.alwaysVisible
    };

    // Update the prompt
    await promptRepository.updatePrompt(updateData, userEmail);

    return {
      result: {
        success: true,
        prompt: {
          name: updateData.name,
          description: updateData.description,
          arguments: updateData.arguments,
          handler: updateData.handler,
          rolesPermitted: updateData.rolesPermitted,
          alwaysVisible: updateData.alwaysVisible,
          updatedBy: userEmail
        }
      }
    };
  } catch (error) {
    logger.error("Error in handleUpdatePromptAction:", error);
    throw error;
  }
}