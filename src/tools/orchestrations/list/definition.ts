import { z } from "zod";

export const listOrchestrationsSchema = z.object({
  nameContains: z
    .string()
    .optional()
    .describe("Filter orchestrations by name containing this string"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of orchestrations to return"),
  offset: z.number().optional().describe("Number of orchestrations to skip"),
});

export type ListOrchestrationsInput = z.infer<typeof listOrchestrationsSchema>;

export default {
  name: "dlx_orchestrations_list",
  description: "List all DLX orchestrations",
  schema: listOrchestrationsSchema,
};
