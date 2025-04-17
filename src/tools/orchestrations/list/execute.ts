import { DlxService } from "../../../services/DlxService.js";

export default async function execute(
  {
    nameContains,
    limit,
    offset,
  }: { nameContains?: string; limit?: number; offset?: number },
  context: any,
) {
  const dlxService = new DlxService();
  const params: Record<string, any> = {};
  if (nameContains) params.nameContains = nameContains;
  if (typeof limit !== "undefined") params.limit = limit;
  if (typeof offset !== "undefined") params.offset = offset;

  return await dlxService.executeDlxApiCall(
    {
      method: "GET",
      path: "/orchestrations",
      params,
    },
    context,
  );
}
