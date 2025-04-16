import { DlxService } from "../../../services/DlxService.js";

// Define the input type based on our schema
interface ListOrchestrationsInput {
  nameContains?: string;
  limit?: number;
  offset?: number;
}

export default async function execute(
  input: ListOrchestrationsInput,
  context: any,
) {
  const dlxService = new DlxService();
  const params: Record<string, any> = {};
  if (input.nameContains) params.nameContains = input.nameContains;
  if (typeof input.limit !== "undefined") params.limit = input.limit;
  if (typeof input.offset !== "undefined") params.offset = input.offset;

  return await dlxService.executeDlxApiCall(
    {
      method: "GET",
      path: "/orchestrations",
      params,
    },
    context,
  );
}
