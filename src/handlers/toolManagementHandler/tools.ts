import type { ToolDefinition } from "../../mcp/types.js";
1;
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
    rolesPermitted: ["user", "power-user", "admin"],
    annotations: {
      title: "List Tools",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    alwaysUsed: true,
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
    name: "use-tools",
    description: "Select tools to add to your in-use list (usedTools)",
    inputSchema: {
      type: "object" as const,
      properties: {
        toolIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of tool names to add to your in-use list",
        },
      },
      required: ["toolIds"],
    },
    rolesPermitted: ["user", "power-user", "admin"],
    annotations: {
      title: "Use Tools",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    alwaysUsed: true,
    handler: {
      type: "tool-management",
      config: {
        action: "use-tools",
      },
    },
  },
];
