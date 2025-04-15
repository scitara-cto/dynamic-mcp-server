import { DlxService } from "../../../services/DlxService.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// Define the input type based on our schema
interface ListOrchestrationsInput {
  nameContains?: string;
  limit?: number;
  offset?: number;
}

// Define the context type to access the auth info
interface ToolContext {
  authInfo?: AuthInfo;
}

export default async function execute(
  input: ListOrchestrationsInput,
  context?: ToolContext,
) {
  const dlxService = new DlxService();

  const params: Record<string, any> = {};

  if (input.nameContains) {
    params.nameContains = input.nameContains;
  }

  if (typeof input.limit !== "undefined") {
    params.limit = input.limit;
  }

  if (typeof input.offset !== "undefined") {
    params.offset = input.offset;
  }

  // Extract token from authInfo if available
  let token: string | undefined;
  if (context?.authInfo?.token) {
    token = context.authInfo.token;
  }

  try {
    const orchestrations = await dlxService.executeDlxApiCall({
      method: "GET",
      path: "/orchestrations",
      params,
      token,
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
