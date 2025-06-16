# MCP Prompt Support for Handlers

This document explains how to add MCP prompt support to handlers in the Dynamic MCP Server framework.

## Overview

The Dynamic MCP Server now supports MCP prompts in addition to tools. Prompts are templates that generate conversational content (messages) rather than executing actions. They're perfect for:

- Generating documentation and explanations
- Creating templates and examples
- Providing troubleshooting guides
- Offering interactive help content

## Key Components

### 1. Prompt Definition

Prompts are defined using the `PromptDefinition` interface:

```typescript
interface PromptDefinition {
  name: string;                    // Unique prompt identifier
  description?: string;            // Human-readable description
  arguments?: PromptArgumentDefinition[]; // Optional input parameters
  handler: {                       // Handler configuration
    type: string;                  // Handler type name
    config: {                      // Handler-specific config
      [key: string]: any;
    };
  };
  rolesPermitted?: string[];       // User roles that can use this prompt
  alwaysVisible?: boolean;         // Whether visible to all users
}
```

### 2. Prompt Arguments

Prompts can accept arguments for customization:

```typescript
interface PromptArgumentDefinition {
  name: string;                    // Argument name
  description?: string;            // Argument description
  required?: boolean;              // Whether argument is required
}
```

### 3. Prompt Output

Prompt handlers return `PromptOutput` containing conversational messages:

```typescript
interface PromptOutput {
  description?: string;            // Optional prompt description
  messages: Array<{               // Array of conversation messages
    role: "user" | "assistant";   // Message role
    content: {                     // Message content
      type: "text";                // Content type (text or image)
      text: string;                // Text content
    } | {
      type: "image";               // Image content
      data: string;                // Base64 image data
      mimeType: string;            // Image MIME type
    };
  }>;
}
```

## Adding Prompts to Handlers

### Step 1: Define Your Prompts

Create a prompts file for your handler:

```typescript
// src/handlers/myHandler/prompts.ts
import { PromptDefinition } from "../../mcp/types.js";

export const myHandlerPrompts: PromptDefinition[] = [
  {
    name: "explain-feature",
    description: "Generate an explanation of a specific feature",
    arguments: [
      {
        name: "featureName",
        description: "The name of the feature to explain",
        required: true,
      },
      {
        name: "includeExamples",
        description: "Whether to include usage examples",
        required: false,
      },
    ],
    handler: {
      type: "my-handler",
      config: {
        action: "explain",
      },
    },
    alwaysVisible: true,
  },
];
```

### Step 2: Create Prompt Action Handlers

Create action handlers that return `PromptOutput`:

```typescript
// src/handlers/myHandler/actions/explain.ts
import { PromptOutput } from "../../../mcp/types.js";

export async function handleExplainAction(
  args: Record<string, any>,
  context: any,
  handlerConfig: { action: string },
): Promise<PromptOutput> {
  const { featureName, includeExamples } = args;
  
  let explanation = `# ${featureName} Feature Guide\n\n`;
  explanation += `This feature helps you ${featureName}...\n\n`;
  
  if (includeExamples === "true") {
    explanation += "## Examples\n\n";
    explanation += "Here are some usage examples...\n";
  }

  return {
    description: `Explanation for feature: ${featureName}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Can you explain the ${featureName} feature?`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: explanation,
        },
      },
    ],
  };
}
```

### Step 3: Update Handler Package

Include prompts in your handler package:

```typescript
// src/handlers/myHandler/index.ts
import { myHandlerPrompts } from "./prompts.js";
import { handleExplainAction } from "./actions/explain.js";

const actionHandlers = {
  // ... existing tool handlers
  explain: handleExplainAction, // Add prompt handlers
};

export const myHandlerPackage: HandlerPackage = {
  name: "my-handler",
  handler,
  tools: myHandlerTools,
  prompts: myHandlerPrompts, // Add prompts array
};
```

### Step 4: Update Action Handler Types

Update your action handlers to support both tools and prompts:

```typescript
const actionHandlers: Record<
  string,
  (
    args: Record<string, any>,
    context: any,
    handlerConfig: { action: string },
  ) => Promise<ToolOutput | PromptOutput> // Support both types
> = {
  // ... handlers
};
```

## MCP Protocol Integration

The framework automatically handles MCP protocol integration:

### Prompt Listing (`prompts/list`)

Clients can list available prompts:

```json
{
  "method": "prompts/list",
  "params": {}
}
```

Response:
```json
{
  "prompts": [
    {
      "name": "explain-feature",
      "description": "Generate an explanation of a specific feature",
      "arguments": [
        {
          "name": "featureName",
          "description": "The name of the feature to explain",
          "required": true
        }
      ]
    }
  ]
}
```

### Prompt Execution (`prompts/get`)

Clients can execute prompts:

```json
{
  "method": "prompts/get",
  "params": {
    "name": "explain-feature",
    "arguments": {
      "featureName": "authentication",
      "includeExamples": "true"
    }
  }
}
```

Response:
```json
{
  "description": "Explanation for feature: authentication",
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Can you explain the authentication feature?"
      }
    },
    {
      "role": "assistant",
      "content": {
        "type": "text",
        "text": "# Authentication Feature Guide\n\n..."
      }
    }
  ]
}
```

## Database Storage

Prompts are stored in MongoDB using the `Prompt` model:

- User-specific prompts (created by specific users)
- System prompts (created by handlers during registration)
- Role-based access control
- Always-visible prompts for common functionality

## Notifications

The framework sends `notifications/prompts/list_changed` when:

- New prompts are added
- Existing prompts are updated or deleted
- Prompt permissions change

## Example Implementations

### 1. Documentation Generator

```typescript
{
  name: "generate-api-docs",
  description: "Generate API documentation for an endpoint",
  arguments: [
    { name: "endpoint", required: true },
    { name: "method", required: true },
    { name: "includeExamples", required: false }
  ],
  handler: { type: "docs-generator", config: { action: "api-docs" } }
}
```

### 2. Troubleshooting Guide

```typescript
{
  name: "troubleshoot-error",
  description: "Generate troubleshooting steps for an error",
  arguments: [
    { name: "errorMessage", required: true },
    { name: "component", required: false }
  ],
  handler: { type: "support", config: { action: "troubleshoot" } }
}
```

### 3. Code Template

```typescript
{
  name: "create-component-template",
  description: "Generate a code template for a new component",
  arguments: [
    { name: "componentName", required: true },
    { name: "framework", required: true },
    { name: "includeTests", required: false }
  ],
  handler: { type: "code-generator", config: { action: "template" } }
}
```

## Best Practices

1. **Clear Naming**: Use descriptive, action-oriented prompt names
2. **Comprehensive Descriptions**: Explain what the prompt does and when to use it
3. **Minimal Arguments**: Keep required arguments to a minimum
4. **Rich Content**: Use markdown formatting for better readability
5. **Error Handling**: Handle missing arguments gracefully
6. **Security**: Set appropriate role permissions for sensitive prompts
7. **Testing**: Test prompts with various argument combinations

## Migration from Tools

If you have existing tools that generate text content, consider converting them to prompts:

- **Tools**: For actions that modify state or perform operations
- **Prompts**: For generating documentation, explanations, or templates

This separation provides better user experience and follows MCP best practices.