// Define the input schema in MCP format
export const inputSchema = {
  type: "object" as const,
  properties: {
    nameContains: {
      type: "string",
      description: "Filter orchestrations by name containing this string",
      optional: true,
    },
    limit: {
      type: "number",
      description: "Maximum number of orchestrations to return",
      optional: true,
    },
    offset: {
      type: "number",
      description: "Number of orchestrations to skip",
      optional: true,
    },
  },
};

export default {
  name: "dlx_orchestrations_list",
  description: "List all DLX orchestrations",
  inputSchema,
  annotations: {
    title: "List Orchestrations",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};
