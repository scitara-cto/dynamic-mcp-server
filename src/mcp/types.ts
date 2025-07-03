import { z } from "zod";
import { Request, Response } from "express";
import { DynamicMcpServer } from "./server.js";

/**
 * Represents the standard output format for all tools
 * @template T The type of the result data
 */
export interface ToolOutput<T = any> {
  /** The actual data returned by the tool */
  result: T;
  /** A message describing the operation result */
  message?: string;
  /** Suggested next steps for the user */
  nextSteps?: string[];
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
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
    config: {
      [key: string]: any;
    };
  };
  rolesPermitted?: string[];
  alwaysVisible?: boolean;
}

// Extended tool schema that includes annotations
export const ExtendedToolSchema = z
  .object({
    name: z.string(),
    description: z.optional(z.string()),
    inputSchema: z
      .object({
        type: z.literal("object"),
        properties: z.optional(z.record(z.unknown())),
        required: z.optional(z.array(z.string())),
      })
      .passthrough(),
    annotations: z
      .object({
        title: z.optional(z.string()),
        readOnlyHint: z.optional(z.boolean()),
        destructiveHint: z.optional(z.boolean()),
        idempotentHint: z.optional(z.boolean()),
        openWorldHint: z.optional(z.boolean()),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// Type for tool definitions with handler function
export interface RuntimeToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
  handler: (...args: any[]) => Promise<any>;
  annotations?: Record<string, unknown>;
}

/**
 * Represents a prompt argument definition
 */
export interface PromptArgumentDefinition {
  /** The name of the argument */
  name: string;
  /** A human-readable description of the argument */
  description?: string;
  /** Whether this argument must be provided */
  required?: boolean;
}

/**
 * Represents a prompt definition for handlers
 */
export interface PromptDefinition {
  /** The name of the prompt */
  name: string;
  /** An optional description of what this prompt provides */
  description?: string;
  /** A list of arguments to use for templating the prompt */
  arguments?: PromptArgumentDefinition[];
  /** Handler configuration for this prompt */
  handler: {
    type: string;
    config: {
      [key: string]: any;
    };
  };
  /** Roles permitted to use this prompt */
  rolesPermitted?: string[];
  /** Whether this prompt is always visible regardless of user permissions */
  alwaysVisible?: boolean;
}

/**
 * Represents the output format for prompt handlers
 */
export interface PromptOutput {
  /** Optional description for the prompt */
  description?: string;
  /** Array of messages that make up the prompt */
  messages: Array<{
    role: "user" | "assistant";
    content: {
      type: "text";
      text: string;
    } | {
      type: "image";
      data: string;
      mimeType: string;
    };
  }>;
}

export type HandlerFunction = (
  args: Record<string, any>,
  context: any,
  config: any,
  progress?: (progress: number, total?: number, message?: string) => void,
) => Promise<any>;

export interface AuthRoute {
  path: string;
  method: "get" | "post" | "put" | "delete" | "patch";
  handler: (req: Request, res: Response) => void;
}

export interface HandlerPackage {
  name: string;
  tools: ToolDefinition[];
  prompts?: PromptDefinition[];
  handler: HandlerFunction;
  testScript?: string; // Path to a markdown test script or inline script
  authRoutes?: AuthRoute[];
  init?: () => Promise<void>;
}
