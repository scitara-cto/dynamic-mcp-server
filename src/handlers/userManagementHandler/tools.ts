import type { ToolDefinition } from "../../mcp/types.js";

export const userManagementTools: ToolDefinition[] = [
  {
    name: "list-users",
    description: "List all users",
    inputSchema: {
      type: "object" as const,
      properties: {
        nameContains: {
          type: "string",
          description: "Filter users by name (case-insensitive)",
        },
        skip: { type: "number", description: "Skip N users" },
        limit: {
          type: "number",
          description: "Limit number of users returned",
        },
      },
    },
    annotations: {
      title: "List Users",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "user-management",
      config: {
        action: "list",
      },
    },
  },
  {
    name: "add-user",
    description: "Add a new user",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: { type: "string", description: "User email" },
        name: { type: "string", description: "User name" },
        roles: {
          type: "array",
          items: { type: "string" },
          description: "User roles",
        },
      },
      required: ["email"],
    },
    annotations: {
      title: "Add User",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: {
      type: "user-management",
      config: {
        action: "add",
      },
    },
  },
  {
    name: "update-user",
    description: "Update an existing user",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description:
            "User email (required). If the email is unknown, use the list-users tool to find a user by name.",
        },
        name: { type: "string", description: "User name" },
        roles: {
          type: "array",
          items: { type: "string" },
          description: "User roles",
        },
        allowedTools: {
          type: "array",
          items: { type: "string" },
          description:
            "List of tool names the user is allowed to access. Use the list-tools tool to get a list of valid tools before executing this tool.",
        },
        sharedTools: {
          type: "array",
          items: {
            type: "object",
            properties: {
              toolId: { type: "string", description: "Tool ID" },
              sharedBy: { type: "string", description: "Who shared the tool" },
              accessLevel: {
                type: "string",
                enum: ["read", "write"],
                description: "Access level",
              },
              sharedAt: {
                type: "string",
                format: "date-time",
                description: "When the tool was shared",
              },
            },
            required: ["toolId", "sharedBy", "accessLevel", "sharedAt"],
          },
          description:
            "List of shared tools with access details. Use the list-tools tool to get a list of valid tools before executing this tool.",
        },
      },
      required: ["email"],
    },
    annotations: {
      title: "Update User",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: {
      type: "user-management",
      config: {
        action: "update",
      },
    },
  },
  {
    name: "delete-user",
    description: "Delete a user",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description:
            "User email (required). If the email is unknown, use the list-users tool to find a user by name.",
        },
      },
      required: ["email"],
    },
    annotations: {
      title: "Delete User",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: {
      type: "user-management",
      config: {
        action: "delete",
      },
    },
  },
  {
    name: "share-tool",
    description:
      "Share a tool with another user (adds to their sharedTools array)",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description:
            "Recipient user's email. Use list-users to find the user if needed.",
        },
        toolId: {
          type: "string",
          description:
            "Tool name/ID to share. Use list-tools to get valid tool names.",
        },
        accessLevel: {
          type: "string",
          enum: ["read", "write"],
          description: "Access level to grant (read or write)",
        },
      },
      required: ["email", "toolId", "accessLevel"],
    },
    annotations: {
      title: "Share Tool",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: {
      type: "user-management",
      config: {
        action: "share-tool",
      },
    },
  },
  {
    name: "unshare-tool",
    description:
      "Unshare a tool from a user (removes from their sharedTools array)",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description:
            "Recipient user's email. Use list-users to find the user if needed.",
        },
        toolId: {
          type: "string",
          description:
            "Tool name/ID to unshare. Use list-tools to get valid tool names.",
        },
      },
      required: ["email", "toolId"],
    },
    annotations: {
      title: "Unshare Tool",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: {
      type: "user-management",
      config: {
        action: "unshare-tool",
      },
    },
  },
];
