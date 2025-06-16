import { PromptOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";

export async function handleAddPromptAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<PromptOutput> {
  try {
    const { promptName, description, includeArguments } = args;
    
    let template = "# Prompt Creation Template\n\n";
    template += "Here's a template for creating a new prompt:\n\n";
    
    template += "```json\n";
    template += "{\n";
    template += `  "name": "${promptName || 'your-prompt-name'}",\n`;
    template += `  "description": "${description || 'A description of what this prompt does'}",\n`;
    
    if (includeArguments === "true" || includeArguments === true) {
      template += '  "arguments": [\n';
      template += '    {\n';
      template += '      "name": "exampleArg",\n';
      template += '      "description": "An example argument",\n';
      template += '      "required": true\n';
      template += '    }\n';
      template += '  ],\n';
    }
    
    template += '  "handler": {\n';
    template += '    "type": "your-handler-name",\n';
    template += '    "config": {\n';
    template += '      "action": "your-action"\n';
    template += '    }\n';
    template += '  },\n';
    template += '  "rolesPermitted": ["user"],\n';
    template += '  "alwaysVisible": false\n';
    template += "}\n";
    template += "```\n\n";
    
    template += "## Key Fields:\n\n";
    template += "- **name**: Unique identifier for the prompt\n";
    template += "- **description**: Human-readable description of the prompt's purpose\n";
    template += "- **arguments**: Optional array of input parameters the prompt accepts\n";
    template += "- **handler**: Configuration for which handler processes this prompt\n";
    template += "- **rolesPermitted**: Array of user roles that can use this prompt\n";
    template += "- **alwaysVisible**: Whether the prompt is visible to all users\n\n";
    
    template += "## Next Steps:\n\n";
    template += "1. Customize the template above with your specific requirements\n";
    template += "2. Ensure your handler exists and can process the specified action\n";
    template += "3. Test the prompt with various argument combinations\n";
    template += "4. Add appropriate role permissions for security\n";

    return {
      description: "Template for creating a new prompt",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a template for a new prompt${promptName ? ` named "${promptName}"` : ""}.`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: template,
          },
        },
      ],
    };
  } catch (error) {
    logger.error("Error in handleAddPromptAction:", error);
    throw error;
  }
}