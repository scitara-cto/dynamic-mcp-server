import type { ToolDefinition } from "../index.js";

export const toolManagementTools: ToolDefinition[] = [
  {
    name: "list-tools",
    description: "List all tools",
    inputSchema: {
      type: "object" as const,
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
      config: {
        action: "list",
      },
    },
  },
  {
    name: "delete-tool",
    description: "Delete a tool",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The name of the tool" },
      },
    },
    annotations: {
      title: "Delete Tool",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "tool-management",
      config: {
        action: "delete",
      },
    },
  },
];
