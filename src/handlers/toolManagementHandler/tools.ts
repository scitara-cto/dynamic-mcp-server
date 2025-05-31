import type { ToolDefinition } from "../../mcp/types.js";
1;
export const toolManagementTools: ToolDefinition[] = [
  {
    name: "list-tools",
    description: "List all tools",
    alwaysVisible: true,
    inputSchema: {
      type: "object" as const,
      properties: {
        nameContains: {
          type: "string",
          description: "Filter tools by name (case-insensitive)",
        },
      },
    },
    rolesPermitted: ["user", "power-user", "admin"],
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
    rolesPermitted: ["admin", "power-user"],
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
  {
    name: "update-tool",
    description: "Update an existing tool's definition or properties",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The name of the tool to update" },
        updates: {
          type: "object",
          description:
            "The fields to update in the tool definition (excluding name)",
        },
      },
      required: ["name", "updates"],
    },
    rolesPermitted: ["admin", "power-user"],
    annotations: {
      title: "Update Tool",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "tool-management",
      config: {
        action: "update",
      },
    },
  },
];
