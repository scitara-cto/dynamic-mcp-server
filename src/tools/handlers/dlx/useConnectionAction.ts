import { SessionInfo } from "../../../mcp/server.js";
import { ToolOutput } from "../index.js";
import { DlxService } from "../../../services/DlxService.js";
import logger from "../../../utils/logger.js";

interface Connection {
  id: string;
  name: string;
  connector: {
    id: string;
  };
}

interface ConnectorAction {
  title: string;
  description: string;
  usage: string[];
  optionsSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface Connector {
  id: string;
  name: string;
  actions: Record<string, ConnectorAction>;
}

/**
 * Handles the "use-connection" action for the DLX handler
 * This action creates tools for each action that a connection can execute
 * @param args The arguments passed to the tool
 * @param context The session context containing authentication information
 * @param handlerConfig The handler configuration from the tool definition
 * @returns A promise that resolves to the tool output
 */
export async function handleUseConnectionAction(
  args: Record<string, any>,
  context: SessionInfo,
  handlerConfig: {
    connectionId?: string;
  },
): Promise<ToolOutput> {
  try {
    const connectionId = args.connectionId || handlerConfig.connectionId;
    if (!connectionId) {
      throw new Error("Missing required parameter: connectionId");
    }

    if (!context.mcpServer) {
      throw new Error("McpServer not available in context");
    }

    const dlxService = new DlxService();

    // Fetch connection details
    const connection = (await dlxService.executeDlxApiCall(
      {
        method: "GET",
        path: `/connections/${connectionId}`,
      },
      context,
    )) as Connection;

    // Fetch connector details
    const connector = (await dlxService.executeDlxApiCall(
      {
        method: "GET",
        path: `/connectors/${connection.connector.id}`,
      },
      context,
    )) as Connector;

    const createdTools: string[] = [];

    // Create tools for each published action
    for (const [actionName, actionDef] of Object.entries(connector.actions)) {
      if (!actionDef.usage || !actionDef.usage.includes("published")) {
        continue;
      }

      const toolName = `${connection.name}-${actionName}`;
      const toolDescription =
        actionDef.description ||
        `Execute ${actionDef.title || actionName} on ${connection.name}`;

      const tool = {
        name: toolName,
        description: toolDescription,
        inputSchema: {
          type: "object" as const,
          properties: {
            options: {
              type: "object" as const,
              properties: actionDef.optionsSchema.properties || {},
              required: actionDef.optionsSchema.required || [],
            },
          },
          required: ["options"],
        },
        annotations: {
          title: actionDef.title || actionName,
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
        handler: {
          type: "dlx",
          config: {
            action: "api-call",
            path: `/connections/${connectionId}/actions/${actionName}`,
            method: "POST",
            body: ["options"],
          },
        },
      };

      await context.mcpServer.toolGenerator.registerTool(tool);
      createdTools.push(toolName);
    }

    return {
      result: {
        connectionId,
        connectionName: connection.name,
        connectorName: connector.name,
        createdTools,
      },
      message: `Successfully created ${createdTools.length} tools for connection "${connection.name}"`,
    };
  } catch (error) {
    logger.error(`Error in useConnectionAction: ${error}`);
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
