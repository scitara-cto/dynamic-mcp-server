/**
 * Represents the standard output format for all tools
 * @template T The type of the result data
 */
export interface ToolOutput<T = any> {
  /** The actual data returned by the tool */
  result: T;
  /** A message describing the operation result */
  message?: string;
  /** Suggested next steps for the user */
  nextSteps?: string[];
}

/**
 * Represents the MCP server's expected output format
 */
export interface McpToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError: boolean;
}
