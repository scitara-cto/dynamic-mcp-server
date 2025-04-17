import execute from "./execute.js";
import { inputSchema } from "./definition.js";

// Export the tool configuration and handler
export default {
  name: "dlx_orchestrations_list",
  inputSchema,
  description: "List available DLX orchestrations with optional filtering",
  handler: execute,
  annotations: {
    title: "List Orchestrations",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};
