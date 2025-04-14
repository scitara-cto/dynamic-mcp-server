import { DlxService } from "../../../services/DlxService.js";

// Define the input type based on our schema
interface ListOrchestrationsInput {
  nameContains?: string;
  limit?: number;
  offset?: number;
}

export default async function execute(input: ListOrchestrationsInput) {
  const dlxService = new DlxService();

  const params: Record<string, any> = {};

  if (input.nameContains) {
    params.nameContains = input.nameContains;
  }

  if (input.limit) {
    params.limit = input.limit;
  }

  if (input.offset) {
    params.offset = input.offset;
  }

  try {
    const orchestrations = await dlxService.executeDlxApiCall({
      method: "GET",
      path: "/orchestrations",
      params,
    });

    // Return in MCP tool response format
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(orchestrations, null, 2),
        },
      ],
    };
  } catch (error) {
    // Handle errors in MCP format
    return {
      content: [
        {
          type: "text",
          text: `Error listing orchestrations: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
