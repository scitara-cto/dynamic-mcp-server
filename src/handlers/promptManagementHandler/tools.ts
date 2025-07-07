import type { ToolDefinition } from "../../mcp/types.js";

export const promptManagementTools: ToolDefinition[] = [
  {
    name: "list-prompts",
    description: "List all available prompts for the current user",
    alwaysVisible: true,
    inputSchema: {
      type: "object" as const,
      properties: {
        nameContains: {
          type: "string",
          description: "Filter prompts by name (case-insensitive)",
        },
      },
    },
    rolesPermitted: ["user", "power-user", "admin"],
    annotations: {
      title: "List Prompts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "prompt-management",
      config: {
        action: "list",
      },
    },
  },
  {
    name: "add-prompt",
    description: "Add a new prompt to the system",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The unique name for the prompt",
        },
        description: {
          type: "string",
          description: "A description of what the prompt does",
        },
        arguments: {
          type: "array",
          description: "Array of argument definitions for the prompt",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Argument name" },
              description: { type: "string", description: "Argument description" },
              required: { type: "boolean", description: "Whether argument is required" },
            },
            required: ["name"],
          },
        },
        handler: {
          type: "object",
          description: "Handler configuration for the prompt",
          properties: {
            type: { type: "string", description: "Handler type" },
            config: { type: "object", description: "Handler configuration" },
          },
          required: ["type", "config"],
        },
        rolesPermitted: {
          type: "array",
          description: "Array of roles permitted to use this prompt",
          items: { type: "string", enum: ["user", "power-user", "admin"] },
        },
        alwaysVisible: {
          type: "boolean",
          description: "Whether the prompt is visible to all users",
        },
      },
      required: ["name", "handler"],
    },
    rolesPermitted: ["admin", "power-user"],
    annotations: {
      title: "Add Prompt",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    handler: {
      type: "prompt-management",
      config: {
        action: "add",
      },
    },
  },
  {
    name: "update-prompt",
    description: "Update an existing prompt's definition or properties",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The name of the prompt to update",
        },
        updates: {
          type: "object",
          description: "The fields to update in the prompt definition (excluding name)",
          properties: {
            description: { type: "string" },
            arguments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  required: { type: "boolean" },
                },
              },
            },
            handler: {
              type: "object",
              properties: {
                type: { type: "string" },
                config: { type: "object" },
              },
            },
            rolesPermitted: {
              type: "array",
              items: { type: "string", enum: ["user", "power-user", "admin"] },
            },
            alwaysVisible: { type: "boolean" },
          },
        },
      },
      required: ["name", "updates"],
    },
    rolesPermitted: ["admin", "power-user"],
    annotations: {
      title: "Update Prompt",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "prompt-management",
      config: {
        action: "update",
      },
    },
  },
  {
    name: "delete-prompt",
    description: "Delete a prompt from the system",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The name of the prompt to delete",
        },
      },
      required: ["name"],
    },
    rolesPermitted: ["admin", "power-user"],
    annotations: {
      title: "Delete Prompt",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: {
      type: "prompt-management",
      config: {
        action: "delete",
      },
    },
  },
];