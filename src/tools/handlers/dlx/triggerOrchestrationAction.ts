import { SessionInfo } from "../../../mcp/server.js";
import { ToolOutput } from "../index.js";
import { DlxService } from "../../../services/DlxService.js";
import logger from "../../../utils/logger.js";

interface ExecutionResponse {
  state: string;
  executionId: string;
}

interface StepStatus {
  stepNumber: number;
  stepId: string;
  status: string;
  $links: Array<{
    rel: string;
    href: string;
  }>;
}

interface ExecutionDetails {
  id: string;
  status: string;
  orchestrationName: string;
  statusOfSteps: StepStatus[];
}

interface StepOutput {
  status: string;
  result: {
    output: any;
    attachments: any[];
    executionInfo: {
      language: string;
      statusCode: number;
      duration: string;
      memoryUsed: string;
      memoryLimit: string;
    };
  };
}

/**
 * Handles the "trigger-orchestration" action for the DLX handler
 * This action triggers a specific orchestration with the provided data
 * @param args The arguments passed to the tool
 * @param context The session context containing authentication information
 * @param handlerConfig The handler configuration from the tool definition
 * @returns A promise that resolves to the tool output
 */
export async function handleTriggerOrchestrationAction(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: {
    orchestrationId?: string;
    data?: any;
  },
): Promise<ToolOutput> {
  try {
    const orchestrationId =
      args.orchestrationId || handlerConfig.orchestrationId;
    if (!orchestrationId) {
      throw new Error("Missing required parameter: orchestrationId");
    }

    const data = args.data;

    if (!context.mcpServer) {
      throw new Error("McpServer not available in context");
    }

    const dlxService = new DlxService();

    // Trigger the orchestration
    const triggerResponse = (await dlxService.executeDlxApiCall(
      {
        method: "POST",
        path: `/orchestrations/${orchestrationId}/trigger`,
        data: { data },
      },
      context,
    )) as ExecutionResponse;

    // Get execution details
    const executionDetails = (await dlxService.executeDlxApiCall(
      {
        method: "GET",
        path: `/executions/${triggerResponse.executionId}`,
      },
      context,
    )) as ExecutionDetails;

    // Get step outputs
    const stepOutputs = await Promise.all(
      executionDetails.statusOfSteps.map(async (step) => {
        const outputLink = step.$links.find(
          (link) => link.rel === "step-output",
        );
        if (!outputLink) {
          return null;
        }

        const output = (await dlxService.executeDlxApiCall(
          {
            method: "GET",
            path: outputLink.href,
          },
          context,
        )) as StepOutput;

        return output.result;
      }),
    );

    return {
      result: {
        steps_output: stepOutputs.filter(Boolean),
      },
    };
  } catch (error) {
    logger.error(`Error in triggerOrchestrationAction: ${error}`);
    if (error instanceof Error) {
      // Check if the error is already a DLX API Request Error
      if (error.message.startsWith("DLX API Request Error:")) {
        throw error;
      }
      throw new Error(`DLX API Request Error: ${error.message}`);
    }
    throw new Error(`DLX API Request Error: ${String(error)}`);
  }
}
