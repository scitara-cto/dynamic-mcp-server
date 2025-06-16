import { PromptOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";

export async function handleExplainToolAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<PromptOutput> {
  try {
    const { toolName, includeExamples } = args;
    
    if (!toolName) {
      throw new Error("toolName argument is required");
    }

    const { sessionInfo } = context;
    const userEmail = sessionInfo?.user?.email;

    if (!userEmail) {
      throw new Error("User email not found in session context");
    }

    // Get tool information from the user repository
    const tools = await sessionInfo.mcpServer.userRepository.getUserTools(userEmail);
    const tool = tools.find((t: any) => t.name === toolName);

    if (!tool) {
      return {
        description: `Explanation for tool: ${toolName}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Can you explain how to use the "${toolName}" tool?`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: `I couldn't find a tool named "${toolName}" in your available tools. Please check the tool name and try again, or use the list-tools command to see all available tools.`,
            },
          },
        ],
      };
    }

    let explanation = `# ${tool.name} Tool Guide\n\n`;
    
    if (tool.description) {
      explanation += `**Description:** ${tool.description}\n\n`;
    }

    explanation += "## Purpose\n\n";
    explanation += `The \`${tool.name}\` tool is designed to help you ${tool.description || 'perform specific operations'}.\n\n`;

    explanation += "## Parameters\n\n";
    if (tool.inputSchema?.properties) {
      const properties = tool.inputSchema.properties;
      const required = tool.inputSchema.required || [];
      
      for (const [paramName, paramDef] of Object.entries(properties)) {
        const isRequired = required.includes(paramName);
        const paramInfo = paramDef as any;
        
        explanation += `### \`${paramName}\`${isRequired ? ' (required)' : ' (optional)'}\n`;
        if (paramInfo.description) {
          explanation += `${paramInfo.description}\n`;
        }
        if (paramInfo.type) {
          explanation += `- **Type:** ${paramInfo.type}\n`;
        }
        if (paramInfo.enum) {
          explanation += `- **Allowed values:** ${paramInfo.enum.join(', ')}\n`;
        }
        explanation += "\n";
      }
    } else {
      explanation += "This tool doesn't require any parameters.\n\n";
    }

    if (includeExamples === "true" || includeExamples === true) {
      explanation += "## Usage Examples\n\n";
      explanation += `### Basic Usage\n`;
      explanation += "```json\n";
      explanation += `{\n`;
      explanation += `  "name": "${tool.name}",\n`;
      explanation += `  "arguments": {\n`;
      
      if (tool.inputSchema?.properties) {
        const properties = tool.inputSchema.properties;
        const required = tool.inputSchema.required || [];
        const examples: string[] = [];
        
        for (const [paramName, paramDef] of Object.entries(properties)) {
          const paramInfo = paramDef as any;
          let exampleValue = "\"example_value\"";
          
          if (paramInfo.type === "number") {
            exampleValue = "123";
          } else if (paramInfo.type === "boolean") {
            exampleValue = "true";
          } else if (paramInfo.enum) {
            exampleValue = `"${paramInfo.enum[0]}"`;
          }
          
          examples.push(`    "${paramName}": ${exampleValue}`);
        }
        
        explanation += examples.join(",\n");
      }
      
      explanation += `\n  }\n`;
      explanation += "}\n";
      explanation += "```\n\n";
    }

    explanation += "## Tips\n\n";
    explanation += `- Make sure you have the necessary permissions to use the \`${tool.name}\` tool\n`;
    explanation += "- Check that all required parameters are provided\n";
    explanation += "- Review the tool's output for any error messages or next steps\n";

    return {
      description: `Explanation for tool: ${toolName}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Can you explain how to use the "${toolName}" tool?`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: explanation,
          },
        },
      ],
    };
  } catch (error) {
    logger.error("Error in handleExplainToolAction:", error);
    throw error;
  }
}