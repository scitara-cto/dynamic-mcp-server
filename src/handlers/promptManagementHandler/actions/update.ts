import { PromptOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";

export async function handleUpdatePromptAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<PromptOutput> {
  try {
    let bestPractices = "# Prompt Best Practices\n\n";
    bestPractices += "Here are guidelines for creating effective and maintainable prompts:\n\n";
    
    bestPractices += "## 1. Naming Conventions\n\n";
    bestPractices += "- Use kebab-case for prompt names (e.g., `create-user-story`)\n";
    bestPractices += "- Make names descriptive and action-oriented\n";
    bestPractices += "- Avoid generic names like `prompt1` or `helper`\n\n";
    
    bestPractices += "## 2. Clear Descriptions\n\n";
    bestPractices += "- Write concise but comprehensive descriptions\n";
    bestPractices += "- Explain what the prompt does and when to use it\n";
    bestPractices += "- Include expected output format if relevant\n\n";
    
    bestPractices += "## 3. Argument Design\n\n";
    bestPractices += "- Keep required arguments to a minimum\n";
    bestPractices += "- Provide clear descriptions for each argument\n";
    bestPractices += "- Use descriptive argument names\n";
    bestPractices += "- Consider default values for optional arguments\n\n";
    
    bestPractices += "## 4. Message Structure\n\n";
    bestPractices += "- Start with a clear user message that sets context\n";
    bestPractices += "- Provide comprehensive assistant responses\n";
    bestPractices += "- Use proper markdown formatting for readability\n";
    bestPractices += "- Include examples when helpful\n\n";
    
    bestPractices += "## 5. Security Considerations\n\n";
    bestPractices += "- Set appropriate `rolesPermitted` for sensitive prompts\n";
    bestPractices += "- Use `alwaysVisible: false` for role-restricted prompts\n";
    bestPractices += "- Validate and sanitize user inputs in handlers\n";
    bestPractices += "- Avoid exposing sensitive system information\n\n";
    
    bestPractices += "## 6. Handler Configuration\n\n";
    bestPractices += "- Use descriptive handler types and actions\n";
    bestPractices += "- Keep handler config minimal and focused\n";
    bestPractices += "- Document expected config parameters\n";
    bestPractices += "- Handle errors gracefully in handler functions\n\n";
    
    bestPractices += "## 7. Testing and Maintenance\n\n";
    bestPractices += "- Test prompts with various argument combinations\n";
    bestPractices += "- Verify output formatting and content quality\n";
    bestPractices += "- Update prompts when underlying handlers change\n";
    bestPractices += "- Monitor prompt usage and performance\n\n";
    
    bestPractices += "## Example Well-Structured Prompt\n\n";
    bestPractices += "```json\n";
    bestPractices += "{\n";
    bestPractices += '  "name": "generate-api-documentation",\n';
    bestPractices += '  "description": "Generate comprehensive API documentation for a given endpoint with examples and error codes",\n';
    bestPractices += '  "arguments": [\n';
    bestPractices += '    {\n';
    bestPractices += '      "name": "endpoint",\n';
    bestPractices += '      "description": "The API endpoint path (e.g., /api/users)",\n';
    bestPractices += '      "required": true\n';
    bestPractices += '    },\n';
    bestPractices += '    {\n';
    bestPractices += '      "name": "method",\n';
    bestPractices += '      "description": "HTTP method (GET, POST, PUT, DELETE)",\n';
    bestPractices += '      "required": true\n';
    bestPractices += '    },\n';
    bestPractices += '    {\n';
    bestPractices += '      "name": "includeExamples",\n';
    bestPractices += '      "description": "Whether to include request/response examples",\n';
    bestPractices += '      "required": false\n';
    bestPractices += '    }\n';
    bestPractices += '  ],\n';
    bestPractices += '  "handler": {\n';
    bestPractices += '    "type": "documentation-generator",\n';
    bestPractices += '    "config": {\n';
    bestPractices += '      "action": "generate-api-docs",\n';
    bestPractices += '      "format": "markdown"\n';
    bestPractices += '    }\n';
    bestPractices += '  },\n';
    bestPractices += '  "rolesPermitted": ["developer", "admin"],\n';
    bestPractices += '  "alwaysVisible": false\n';
    bestPractices += "}\n";
    bestPractices += "```";

    return {
      description: "Best practices and guidelines for creating effective prompts",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "What are the best practices for creating effective prompts?",
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: bestPractices,
          },
        },
      ],
    };
  } catch (error) {
    logger.error("Error in handleUpdatePromptAction:", error);
    throw error;
  }
}