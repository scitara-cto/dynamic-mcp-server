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
    rolesPermitted: ["user", "power-user", "admin"],
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
    rolesPermitted: ["admin"],
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
    rolesPermitted: ["admin"],
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
    rolesPermitted: ["admin"],
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
    rolesPermitted: ["admin", "power-user"],
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
    rolesPermitted: ["admin", "power-user"],
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
  {
    name: "remove-user",
    description:
      "Remove (delete) a user by email. This action is irreversible. You must confirm with the user that they want to remove the user before actually calling this tool.",
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
    rolesPermitted: ["admin"],
    annotations: {
      title: "Remove User",
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
    name: "user-info",
    description:
      "Retrieve information about a user. If email is omitted, returns the current user's info. Admins get full info for any user. Non-admins get only existence and name for other users.",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description:
            "User email (optional). If omitted, returns info for the current user.",
        },
      },
    },
    rolesPermitted: ["user", "power-user", "admin"],
    annotations: {
      title: "User Info",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "user-management",
      config: {
        action: "user-info",
      },
    },
  },
  {
    name: "hide-tool",
    description: "Hide one or more tools for the current user",
    inputSchema: {
      type: "object" as const,
      properties: {
        toolId: {
          oneOf: [
            { type: "string", description: "The name/ID of the tool to hide." },
            {
              type: "array",
              items: { type: "string" },
              description: "An array of tool names/IDs to hide.",
            },
          ],
          description:
            "The name/ID of the tool to hide, or an array of tool names/IDs.",
        },
      },
      required: ["toolId"],
    },
    rolesPermitted: ["user", "power-user", "admin"],
    annotations: {
      title: "Hide Tool",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    handler: {
      type: "user-management",
      config: {
        action: "hide-tool",
      },
    },
  },
  {
    name: "unhide-tool",
    description:
      "Unhide one or more tools for the current user (removes from hiddenTools array)",
    inputSchema: {
      type: "object" as const,
      properties: {
        toolId: {
          oneOf: [
            {
              type: "string",
              description: "The name/ID of the tool to unhide.",
            },
            {
              type: "array",
              items: { type: "string" },
              description: "An array of tool names/IDs to unhide.",
            },
          ],
          description:
            "The name/ID of the tool to unhide, or an array of tool names/IDs.",
        },
      },
      required: ["toolId"],
    },
    rolesPermitted: ["user", "power-user", "admin"],
    annotations: {
      title: "Unhide Tool",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    handler: {
      type: "user-management",
      config: {
        action: "unhide-tool",
      },
    },
  },
  {
    name: "reset-api-key",
    description:
      "Reset a user's API key and email the new key to the user. Always call this tool first with userConfirmed: false (or omitted). Only set userConfirmed: true after the user has explicitly confirmed. For non-admin users, the email field is ignored and your own API key will be reset.",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description:
            "User email (optional, admin only). Only admins can reset another user's API key. For non-admin users, this field is ignored and your own API key will be reset.",
        },
        userConfirmed: {
          type: "boolean",
          description:
            "Always call this tool first with userConfirmed: false (or omitted). Only set userConfirmed: true after the user has explicitly confirmed they want to reset their API key. The LLM should first confirm with the user before proceeding, then call this tool again with userConfirmed: true.",
        },
      },
    },
    rolesPermitted: ["user", "power-user", "admin"],
    annotations: {
      title: "Reset API Key",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: {
      type: "user-management",
      config: {
        action: "reset-api-key",
      },
    },
  },
];
