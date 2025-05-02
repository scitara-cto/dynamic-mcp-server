import type { ToolDefinition } from "../../index.js";

export const tools: ToolDefinition[] = [
  {
    name: "list-orchestrations",
    description: "List all orchestrations",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Filter by name" },
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
      config: {
        action: "api-call",
        path: "/orchestrations",
        method: "GET",
        params: ["name"],
        successMessage:
          "Orchestrations found (note: there may be more, these are the first few that match the name provided)",
      },
    },
  },
  {
    name: "use-orchestration",
    description: "Create a tool for triggering a specific orchestration",
    inputSchema: {
      type: "object" as const,
      properties: {
        orchestrationId: {
          type: "string",
          description:
            "The ID of the orchestration to create a tool for. Use the list-orchestrations tool to find the ID",
        },
        dataSchema: {
          type: "object",
          description:
            "The schema for the data to trigger the orchestration with.  This should be a JSON schema object that can be found in the orchestration description.  If the orchestration does not have a data schema, you can use an empty object.",
        },
      },
    },
    annotations: {
      title: "Use Orchestration",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "dlx",
      config: {
        action: "use-orchestration",
        dataSchema: "dataSchema",
      },
    },
  },
  {
    name: "list-connections",
    description: "List all connections",
    inputSchema: {
      type: "object" as const,
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
      config: {
        action: "api-call",
        path: "/connections",
        method: "GET",
        params: ["name"],
        successMessage:
          "Connections found (note: there may be more, these are the first few that match the name provided)",
      },
    },
  },
  {
    name: "use-connection",
    description:
      "Create tools for a specific connection based on its capabilities",
    inputSchema: {
      type: "object" as const,
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
      config: {
        action: "use-connection",
      },
    },
  },
];
