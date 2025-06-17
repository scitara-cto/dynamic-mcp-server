import { ToolOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";

export async function handleListPromptsAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<ToolOutput> {
  try {
    const { sessionInfo } = context;
    const userEmail = sessionInfo?.user?.email;
    const { nameContains } = args;

    if (!userEmail) {
      throw new Error("User email not found in session context");
    }

    // Get prompts from the prompt service
    const allPrompts = await sessionInfo.mcpServer.promptService.getPromptsForUser(userEmail);
    
    // Filter prompts if nameContains is provided
    const prompts = nameContains
      ? allPrompts.filter((prompt: any) =>
          prompt.name.toLowerCase().includes(nameContains.toLowerCase())
        )
      : allPrompts;

    return {
      result: {
        prompts: prompts.map((prompt: any) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments || [],
          handler: prompt.handler,
          rolesPermitted: prompt.rolesPermitted || [],
          alwaysVisible: prompt.alwaysVisible || false,
        })),
        total: prompts.length,
        filtered: !!nameContains,
      },
      message: `Found ${prompts.length} prompt(s)${nameContains ? ` matching "${nameContains}"` : ''}`,
      nextSteps: prompts.length === 0
        ? ["Use add-prompt tool to create new prompts", "Check with administrator for available prompts"]
        : ["Use prompts/get to execute a specific prompt", "Use update-prompt or delete-prompt tools to manage prompts"],
    };
  } catch (error) {
    logger.error("Error in handleListPromptsAction:", error);
    throw error;
  }
}