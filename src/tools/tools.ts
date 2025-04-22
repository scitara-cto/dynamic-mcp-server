export interface ToolDefinition {
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
      [key: string]: any;
    };
  };
}

export const tools: ToolDefinition[] = [
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
        action: "api-call",
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
      title: "Trigger Orchestration",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "dlx",
      args: {
        action: "api-call",
        path: "/orchestrations/{orchestrationId}/trigger",
        method: "POST",
        body: ["data"],
      },
    },
  },
  {
    name: "list-connections",
    description: "List all connections",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by name" },
      },
    },
    annotations: {
      title: "List Connections",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "dlx",
      args: {
        action: "api-call",
        path: "/connections",
        method: "GET",
        params: ["name"],
      },
    },
  },
  {
    name: "use-connection",
    description:
      "Create tools for a specific connection based on its capabilities",
    inputSchema: {
      type: "object",
      properties: {
        connectionId: {
          type: "string",
          description:
            "The ID of the connection to use.  Use the list-connections tool to find the connection id if you only know the name.",
        },
      },
    },
    annotations: {
      title: "Use Connection",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "dlx",
      args: {
        action: "use-connection",
      },
    },
  },
  {
    name: "list-tools",
    description: "List all tools",
    inputSchema: {
      type: "object",
      properties: {
        nameContains: {
          type: "string",
          description: "Filter tools by name (case-insensitive)",
        },
      },
    },
    annotations: {
      title: "List Tools",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "tool-management",
      args: {
        action: "list",
      },
    },
  },
  {
    name: "add-tool",
    description: "Add a tool",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the tool" },
        description: {
          type: "string",
          description: "The description of the tool",
        },
        inputSchema: {
          type: "object",
          description: "The input schema of the tool",
        },
        handler: { type: "object", description: "The handler of the tool" },
      },
    },
    annotations: {
      title: "Add Tool",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "tool-management",
      args: {
        action: "add",
        tool: ["name", "description", "inputSchema", "handler"],
      },
    },
  },
];
