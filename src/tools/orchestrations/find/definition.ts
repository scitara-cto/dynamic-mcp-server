export const inputSchema = {
  type: "object" as const,
  properties: {
    nameContains: {
      type: "string",
      description: "Filter orchestrations by name containing this string",
      optional: true,
    }
  },
};

export default {
  name: "dlx_orchestrations_find",
  description: "Find a DLX orchestration by name",
  inputSchema,
  annotations: {
    title: "Find Orchestration",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};
