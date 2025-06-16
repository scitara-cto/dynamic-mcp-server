import { PromptOutput } from "../../../mcp/types.js";
import logger from "../../../utils/logger.js";

export async function handleTroubleshootToolAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<PromptOutput> {
  try {
    const { toolName, errorMessage } = args;
    
    if (!toolName) {
      throw new Error("toolName argument is required");
    }

    let troubleshootingGuide = `# Troubleshooting Guide: ${toolName}\n\n`;
    
    if (errorMessage) {
      troubleshootingGuide += `**Error Message:** \`${errorMessage}\`\n\n`;
    }
    
    troubleshootingGuide += "## Common Issues and Solutions\n\n";
    
    troubleshootingGuide += "### 1. Permission Errors\n";
    troubleshootingGuide += "**Symptoms:** Access denied, unauthorized, or permission-related errors\n\n";
    troubleshootingGuide += "**Solutions:**\n";
    troubleshootingGuide += "- Verify you have the correct role permissions for this tool\n";
    troubleshootingGuide += "- Contact your administrator to check your user permissions\n";
    troubleshootingGuide += "- Ensure you're logged in with the correct account\n\n";
    
    troubleshootingGuide += "### 2. Invalid Parameters\n";
    troubleshootingGuide += "**Symptoms:** Parameter validation errors, missing required fields\n\n";
    troubleshootingGuide += "**Solutions:**\n";
    troubleshootingGuide += "- Check that all required parameters are provided\n";
    troubleshootingGuide += "- Verify parameter types match the expected format\n";
    troubleshootingGuide += "- Review the tool documentation for parameter requirements\n";
    troubleshootingGuide += "- Use the explain-tool-usage prompt for detailed parameter information\n\n";
    
    troubleshootingGuide += "### 3. Network/Connection Issues\n";
    troubleshootingGuide += "**Symptoms:** Timeout errors, connection refused, network unreachable\n\n";
    troubleshootingGuide += "**Solutions:**\n";
    troubleshootingGuide += "- Check your internet connection\n";
    troubleshootingGuide += "- Verify the server is running and accessible\n";
    troubleshootingGuide += "- Try again after a few moments\n";
    troubleshootingGuide += "- Contact support if the issue persists\n\n";
    
    troubleshootingGuide += "### 4. Tool Not Found\n";
    troubleshootingGuide += "**Symptoms:** Tool does not exist, not available, or not registered\n\n";
    troubleshootingGuide += "**Solutions:**\n";
    troubleshootingGuide += "- Verify the tool name is spelled correctly\n";
    troubleshootingGuide += "- Use the list-tools command to see available tools\n";
    troubleshootingGuide += "- Check if the tool has been recently added or removed\n";
    troubleshootingGuide += "- Contact your administrator about tool availability\n\n";
    
    troubleshootingGuide += "### 5. Handler Errors\n";
    troubleshootingGuide += "**Symptoms:** Internal server errors, handler not found, execution failures\n\n";
    troubleshootingGuide += "**Solutions:**\n";
    troubleshootingGuide += "- Check the server logs for detailed error information\n";
    troubleshootingGuide += "- Verify the tool's handler is properly configured\n";
    troubleshootingGuide += "- Try using a different tool to isolate the issue\n";
    troubleshootingGuide += "- Report the issue to your system administrator\n\n";
    
    if (errorMessage) {
      troubleshootingGuide += "## Specific Error Analysis\n\n";
      
      if (errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("unauthorized")) {
        troubleshootingGuide += "This appears to be a **permission-related error**. Please:\n";
        troubleshootingGuide += "1. Check your user role and permissions\n";
        troubleshootingGuide += "2. Contact your administrator if you believe you should have access\n";
        troubleshootingGuide += "3. Verify you're using the correct authentication credentials\n\n";
      } else if (errorMessage.toLowerCase().includes("parameter") || errorMessage.toLowerCase().includes("argument")) {
        troubleshootingGuide += "This appears to be a **parameter validation error**. Please:\n";
        troubleshootingGuide += "1. Review the required parameters for this tool\n";
        troubleshootingGuide += "2. Check that all parameter types are correct\n";
        troubleshootingGuide += "3. Ensure required fields are not missing\n\n";
      } else if (errorMessage.toLowerCase().includes("timeout") || errorMessage.toLowerCase().includes("connection")) {
        troubleshootingGuide += "This appears to be a **network or connectivity issue**. Please:\n";
        troubleshootingGuide += "1. Check your internet connection\n";
        troubleshootingGuide += "2. Try the operation again in a few moments\n";
        troubleshootingGuide += "3. Contact support if the problem persists\n\n";
      } else {
        troubleshootingGuide += "For this specific error, try:\n";
        troubleshootingGuide += "1. Reviewing the error message for specific guidance\n";
        troubleshootingGuide += "2. Checking the tool documentation\n";
        troubleshootingGuide += "3. Contacting support with the full error details\n\n";
      }
    }
    
    troubleshootingGuide += "## Getting Additional Help\n\n";
    troubleshootingGuide += "If these solutions don't resolve your issue:\n\n";
    troubleshootingGuide += "1. **Check Documentation:** Use the explain-tool-usage prompt for detailed tool information\n";
    troubleshootingGuide += "2. **Review Logs:** Check server logs for more detailed error information\n";
    troubleshootingGuide += "3. **Contact Support:** Provide the full error message and steps to reproduce\n";
    troubleshootingGuide += "4. **Try Alternative Tools:** See if similar functionality is available through other tools\n\n";
    
    troubleshootingGuide += `**Tool:** \`${toolName}\`\n`;
    if (errorMessage) {
      troubleshootingGuide += `**Error:** \`${errorMessage}\`\n`;
    }

    return {
      description: `Troubleshooting guide for tool: ${toolName}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I'm having trouble with the "${toolName}" tool${errorMessage ? `. The error message is: ${errorMessage}` : ''}. Can you help me troubleshoot?`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: troubleshootingGuide,
          },
        },
      ],
    };
  } catch (error) {
    logger.error("Error in handleTroubleshootToolAction:", error);
    throw error;
  }
}