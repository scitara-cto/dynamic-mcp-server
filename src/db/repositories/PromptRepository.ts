import { PromptDefinition } from "../../mcp/types.js";
import logger from "../../utils/logger.js";
import { Prompt } from "../models/Prompt.js";

export class PromptRepository {
  /**
   * Add a new prompt to the database
   */
  async addPrompt(promptDef: PromptDefinition, createdBy: string): Promise<void> {
    try {
      // Use upsert to handle duplicates gracefully
      await Prompt.updateOne(
        { name: promptDef.name },
        {
          $set: {
            description: promptDef.description,
            arguments: promptDef.arguments,
            handler: promptDef.handler,
            rolesPermitted: promptDef.rolesPermitted,
            alwaysVisible: promptDef.alwaysVisible,
            createdBy,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error(`Error adding prompt '${promptDef.name}' to database:`, error);
      throw error;
    }
  }

  /**
   * Remove a prompt from the database
   */
  async removePrompt(promptName: string, userEmail: string): Promise<void> {
    try {
      const result = await Prompt.deleteOne({
        name: promptName,
        createdBy: userEmail,
      });

      if (result.deletedCount === 0) {
        throw new Error(`Prompt '${promptName}' not found or not owned by user`);
      }

      logger.info(`Prompt '${promptName}' removed from database`);
    } catch (error) {
      logger.error(`Error removing prompt '${promptName}' from database:`, error);
      throw error;
    }
  }

  /**
   * Update a prompt in the database
   */
  async updatePrompt(promptDef: PromptDefinition, userEmail: string): Promise<void> {
    try {
      const result = await Prompt.updateOne(
        {
          name: promptDef.name,
          createdBy: userEmail,
        },
        {
          $set: {
            description: promptDef.description,
            arguments: promptDef.arguments,
            handler: promptDef.handler,
            rolesPermitted: promptDef.rolesPermitted,
            alwaysVisible: promptDef.alwaysVisible,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        throw new Error(`Prompt '${promptDef.name}' not found or not owned by user`);
      }

      logger.info(`Prompt '${promptDef.name}' updated in database`);
    } catch (error) {
      logger.error(`Error updating prompt '${promptDef.name}' in database:`, error);
      throw error;
    }
  }

  /**
   * Get all prompts for a specific user
   */
  async getPromptsForUser(userEmail: string): Promise<PromptDefinition[]> {
    try {
      const prompts = await Prompt.find({
        $or: [
          { createdBy: userEmail },
          { alwaysVisible: true },
          { rolesPermitted: { $exists: false } },
          { rolesPermitted: { $size: 0 } },
        ],
      }).lean();

      return prompts.map((prompt: any) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
        handler: prompt.handler,
        rolesPermitted: prompt.rolesPermitted,
        alwaysVisible: prompt.alwaysVisible,
      }));
    } catch (error) {
      logger.error(`Error getting prompts for user '${userEmail}':`, error);
      throw error;
    }
  }

  /**
   * Get a specific prompt for a user
   */
  async getPromptForUser(userEmail: string, promptName: string): Promise<PromptDefinition | null> {
    try {
      const prompt = await Prompt.findOne({
        name: promptName,
        $or: [
          { createdBy: userEmail },
          { alwaysVisible: true },
          { rolesPermitted: { $exists: false } },
          { rolesPermitted: { $size: 0 } },
        ],
      }).lean();

      if (!prompt) {
        return null;
      }

      return {
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
        handler: prompt.handler,
        rolesPermitted: prompt.rolesPermitted,
        alwaysVisible: prompt.alwaysVisible,
      };
    } catch (error) {
      logger.error(`Error getting prompt '${promptName}' for user '${userEmail}':`, error);
      throw error;
    }
  }

  /**
   * Reset system prompts (remove all prompts created by system and re-add built-in prompts)
   */
  async resetSystemPrompts(): Promise<void> {
    try {
      // Delete all system prompts
      const result = await Prompt.deleteMany({ createdBy: "system" });
      logger.info(`Reset ${result.deletedCount} system prompts`);

      // Re-add built-in prompts from handler packages
      const { handlerPackages } = await import("../../handlers/index.js");
      const builtinPrompts = handlerPackages
        .flatMap((pkg: any) => pkg.prompts || [])
        .map((prompt: any) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
          handler: prompt.handler,
          rolesPermitted: prompt.rolesPermitted,
          alwaysVisible: prompt.alwaysVisible,
          createdBy: "system",
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

      // Use upsert to add/update built-in prompts
      for (const prompt of builtinPrompts) {
        await Prompt.updateOne(
          { name: prompt.name },
          {
            $set: {
              description: prompt.description,
              arguments: prompt.arguments,
              handler: prompt.handler,
              rolesPermitted: prompt.rolesPermitted,
              alwaysVisible: prompt.alwaysVisible,
              createdBy: "system",
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );
      }

      logger.info(`Added ${builtinPrompts.length} built-in prompts`);
    } catch (error) {
      logger.error("Error resetting system prompts:", error);
      throw error;
    }
  }

  /**
   * Get all prompts (admin function)
   */
  async getAllPrompts(): Promise<PromptDefinition[]> {
    try {
      const prompts = await Prompt.find({}).lean();

      return prompts.map((prompt: any) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
        handler: prompt.handler,
        rolesPermitted: prompt.rolesPermitted,
        alwaysVisible: prompt.alwaysVisible,
      }));
    } catch (error) {
      logger.error("Error getting all prompts:", error);
      throw error;
    }
  }
  async deletePromptsByCreator(
    creator: string,
  ): Promise<{ deletedCount?: number }> {
    if (!creator) {
      throw new Error("Creator is required to delete prompts");
    }
    const result = await Prompt.deleteMany({ createdBy: creator });
    return { deletedCount: result.deletedCount };
  }
}