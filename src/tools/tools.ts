export interface StaticToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    [key: string]: unknown;
  };
  handler: {
    type: string;
    args: {
      path: string;
      method: string;
      params?: string[];
      body?: string | Record<string, any>;
      [key: string]: any;
    };
  };
}

export const tools: StaticToolDefinition[] = [
  {
    name: "list-orchestrations",
    description: "List all orchestrations",
    inputSchema: {
      type: "object",
      properties: {
        nameContains: { type: "string", description: "Filter by name" },
      },
    },
    annotations: {
      title: "Find Orchestration",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "dlx",
      args: {
        path: "/orchestrations",
        method: "GET",
        params: ["nameContains"],
      },
    },
  },
  {
    name: "trigger-orchestration",
    description: "Trigger an orchestration",
    inputSchema: {
      type: "object",
      properties: {
        orchestrationId: {
          type: "string",
          description:
            "The ID of the orchestration to trigger.  Use the list-orchestrations tool to find the ID.",
        },
        data: {
          type: "object",
          description: "The data to trigger the orchestration with",
        },
      },
    },
    annotations: {
      title: "Find Orchestration",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "dlx",
      args: {
        path: "/orchestrations/{orchestrationId}/trigger",
        method: "POST",
        body: ["data"],
      },
    },
  },
];
