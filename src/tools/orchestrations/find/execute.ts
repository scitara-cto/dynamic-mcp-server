import { DlxService } from "../../../services/DlxService.js";
import { SessionInfo } from "../../../mcp/server.js";
import { ToolOutput } from "../../types.js";

export default async function execute(
  { nameContains }: { nameContains?: string },
  sessionInfo: SessionInfo,
): Promise<ToolOutput> {
  const dlxService = new DlxService();

  const response = (await dlxService.executeDlxApiCall(
    {
      method: "GET",
      path: "/orchestrations",
      params: { nameContains },
    },
    sessionInfo,
  )) as { items: any[] };

  return {
    result: response.items,
    message:
      "Successfully retrieved orchestrations, note that only the top 25 results are returned.  Use a more specific search to find a specific orchestration.",
  };
}
