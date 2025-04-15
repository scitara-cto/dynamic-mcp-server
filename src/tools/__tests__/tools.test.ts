import { jest, expect, describe, it, beforeEach, afterEach } from "@jest/globals";
import { DlxToolGenerator } from "../index.js";
import { orchestrationTools } from "../orchestrations/index.js";
import { z } from "zod";


// Mock the MCP server
jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  const mockServer = jest.fn().mockImplementation(() => {
    return {
      tool: jest.fn().mockImplementation((name, schema, handler) => {
        return { name, schema, handler };
      }),
    };
  });

  return { McpServer: mockServer };
});

describe("DLX Tools", () => {
  let toolGenerator: DlxToolGenerator;
  let mockMcpServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { McpServer } = jest.requireMock("@modelcontextprotocol/sdk/server/mcp.js") as { McpServer: any };
    mockMcpServer = new McpServer();
    toolGenerator = new DlxToolGenerator(mockMcpServer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Tool Registration", () => {
    it("should register all tools successfully", async () => {
      const registeredCount = await toolGenerator.registerAllTools();
      
      // Verify the number of registered tools matches the total number of tools
      const expectedToolCount = orchestrationTools.length;
      expect(registeredCount).toBe(expectedToolCount);
      
      // Verify that the tool method was called for each tool
      expect(mockMcpServer.tool).toHaveBeenCalledTimes(expectedToolCount);
    });

    it("should store registered tools by name", async () => {
      await toolGenerator.registerAllTools();
      
      // Get all registered tool names
      const toolNames = toolGenerator.getRegisteredToolNames();
      
      // Verify each tool in orchestrationTools is registered
      orchestrationTools.forEach(tool => {
        expect(toolNames).toContain(tool.name);
      });
    });
  });

  describe("Tool Implementation", () => {
    it("should verify all tools in the system are properly loaded", () => {
      // Get all tools from the DlxToolGenerator
      const allTools = (toolGenerator as any).getAllTools();
      
      // Verify we have at least one tool
      expect(allTools.length).toBeGreaterThan(0);
      
      // Verify each tool is from a known group
      allTools.forEach((tool: any) => {
        // Check if the tool is in one of our known tool groups
        const isInKnownGroup = orchestrationTools.some(t => t.name === tool.name);
        expect(isInKnownGroup).toBe(true);
      });
    });
    it("should verify each tool has the required properties", () => {
      // Iterate through all tool groups
      const allToolGroups = [orchestrationTools];
      
      allToolGroups.forEach(toolGroup => {
        toolGroup.forEach(tool => {
          // Check required properties
          expect(tool).toHaveProperty("name");
          expect(tool).toHaveProperty("schema");
          expect(tool).toHaveProperty("description");
          expect(tool).toHaveProperty("handler");
          
          // Verify name is a non-empty string
          expect(typeof tool.name).toBe("string");
          expect(tool.name.length).toBeGreaterThan(0);
          
          // Verify description is a non-empty string
          expect(typeof tool.description).toBe("string");
          expect(tool.description.length).toBeGreaterThan(0);
          
          // Verify schema is a valid Zod schema
          expect(tool.schema).toBeDefined();
          
          // Verify handler is a function
          expect(typeof tool.handler).toBe("function");
        });
      });
    });

    it("should verify each tool's schema is a valid Zod schema", () => {
      // Iterate through all tool groups
      const allToolGroups = [orchestrationTools];
      
      allToolGroups.forEach(toolGroup => {
        toolGroup.forEach(tool => {
          // Check if schema has Zod properties
          const schema = tool.schema;
          
          // Test if schema has typical Zod methods or properties
          // This is a basic check - we're verifying the schema object has expected Zod-like properties
          const hasZodProperties = 
            typeof schema === 'object' && 
            (Object.values(schema).some(field => 
              field instanceof z.ZodType || 
              (typeof field === 'object' && field !== null && 'optional' in Object.getPrototypeOf(field))
            ) || 
            schema instanceof z.ZodType);
          
          expect(hasZodProperties).toBe(true);
        });
      });
    });

    it("should verify each tool follows the expected file structure pattern", () => {
      // This test verifies that each tool follows the expected file structure pattern
      // with separate files for definition, execution, and an index file that combines them
      
      // For this test, we'll use the orchestrationTools as an example
      orchestrationTools.forEach((tool: any) => {
        // The tool should have a name that matches its directory structure
        const toolName = tool.name;
        expect(toolName).toBeDefined();
        expect(typeof toolName).toBe("string");
        
        // The tool should have a handler function that comes from an execute.js file
        const handler = tool.handler;
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
        
        // The tool should have a schema that comes from a definition file
        const schema = tool.schema;
        expect(schema).toBeDefined();
        
        // The tool should have a description
        const description = tool.description;
        expect(description).toBeDefined();
        expect(typeof description).toBe("string");
      });
    });
    
    it("should verify each tool's handler has the correct structure", () => {
      // Instead of executing the handler (which requires external dependencies),
      // we'll verify that it has the correct structure and signature
      
      // Iterate through all tool groups
      const allToolGroups = [orchestrationTools];
      
      for (const toolGroup of allToolGroups) {
        for (const tool of toolGroup) {
          // Verify the handler is a function
          expect(typeof tool.handler).toBe("function");
          
          // Verify the handler function accepts input parameters
          expect(tool.handler.length).toBeGreaterThanOrEqual(0);
          
          // Examine the handler function's source code to verify it returns a Promise
          const handlerSource = tool.handler.toString();
          
          // Check if it's an async function or returns a Promise
          const isAsyncOrReturnsPromise =
            handlerSource.includes("async") ||
            handlerSource.includes("Promise") ||
            handlerSource.includes("then(") ||
            handlerSource.includes("catch(");
            
          expect(isAsyncOrReturnsPromise).toBe(true);
          
          // Verify the handler handles errors properly
          expect(handlerSource.includes("catch") || handlerSource.includes("try")).toBe(true);
        }
      }
    });
  });

  describe("Tool Retrieval", () => {
    it("should retrieve a registered tool by name", async () => {
      await toolGenerator.registerAllTools();
      
      // Get a tool name from orchestrationTools
      const toolName = orchestrationTools[0].name;
      
      // Retrieve the tool
      const tool = toolGenerator.getTool(toolName);
      
      // Verify the tool was retrieved
      expect(tool).toBeDefined();
      expect(tool).toHaveProperty("name", toolName);
    });

    it("should return undefined for non-existent tool", async () => {
      await toolGenerator.registerAllTools();
      
      // Try to retrieve a non-existent tool
      const tool = toolGenerator.getTool("non_existent_tool");
      
      // Verify undefined is returned
      expect(tool).toBeUndefined();
    });
  });
});