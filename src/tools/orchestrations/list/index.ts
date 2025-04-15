import { z } from "zod";
import execute from "./execute.js";

// Define the input schema using zod
const schema = {
  nameContains: z
    .string()
    .optional()
    .describe("Filter orchestrations by name containing this string"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of orchestrations to return"),
  offset: z.number().optional().describe("Number of orchestrations to skip"),
};

// Export the tool configuration and handler
export default {
  name: "dlx_orchestrations_list",
  schema, // Export the schema for use with server.tool()
  description: "List available DLX orchestrations with optional filtering",
  handler: (input: any, context: any) => execute(input, context),
};
