import execute from "./execute.js";
import { inputSchema } from "./definition.js";

// Export the tool configuration and handler
export default {
  name: "dlx_orchestrations_find",
  inputSchema,
  description: "Find a DLX orchestration by name",
  handler: execute,
  annotations: {
    title: "Find Orchestration",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};
