import { z } from "zod";

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
  alwaysUsed?: boolean;
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

export type HandlerFunction = (
  args: Record<string, any>,
  context: any,
  config: any,
  progress?: (progress: number, total?: number, message?: string) => void,
) => Promise<any>;

export interface HandlerPackage {
  name: string;
  tools: ToolDefinition[];
  handler: HandlerFunction;
  testScript?: string; // Path to a markdown test script or inline script
}
