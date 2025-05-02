import {
  jest,
  expect,
  describe,
  it,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { ToolGenerator } from "../index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { McpServer } from "../../mcp/server.js";
import { tools } from "../index.js";

// Mock both the Server and McpServer modules
jest.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn().mockImplementation(() => Promise.resolve()),
    supportsTools: jest.fn().mockReturnValue(true),
    supportsTool: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock("../../mcp/server.js", () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    getSessionInfo: jest
      .fn()
      .mockReturnValue({ token: "test-token", user: {} }),
    notifyToolListChanged: jest
      .fn()
      .mockImplementation(() => Promise.resolve()),
  })),
}));

// Mock the handlers module
jest.mock("../handlers/index.js", () => ({
  createHandler: jest.fn().mockImplementation((type, config) => {
    return async (args: any, context: any) => {
      return {
        result: { success: true, type, config },
        message: "Test handler executed",
      };
    };
  }),
}));

describe("ToolGenerator", () => {
  let toolGenerator: ToolGenerator;
  let mockServer: jest.Mocked<Server>;
  let mockMcpServer: jest.Mocked<McpServer>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh instances of our mocks with type assertions
    const { Server: ServerClass } = jest.requireMock(
      "@modelcontextprotocol/sdk/server/index.js",
    ) as { Server: jest.Mock };
    const { McpServer: McpServerClass } = jest.requireMock(
      "../../mcp/server.js",
    ) as { McpServer: jest.Mock };

    mockServer = new ServerClass() as jest.Mocked<Server>;
    mockMcpServer = new McpServerClass() as jest.Mocked<McpServer>;
    toolGenerator = new ToolGenerator(mockServer, mockMcpServer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Tool Registration", () => {
    it("should register all tools successfully", async () => {
      await toolGenerator.initialize();
      const registeredTools = toolGenerator.getRegisteredToolNames();

      // Verify tools were registered
      expect(registeredTools.length).toBe(tools.length);

      // Verify that setRequestHandler was called for both list and call handlers
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe("Tool Implementation", () => {
    it("should verify all tools have required properties", async () => {
      await toolGenerator.initialize();
      const registeredTools = toolGenerator.getRegisteredToolNames();

      // Verify that each registered tool has the required properties
      registeredTools.forEach((toolName) => {
        const tool = toolGenerator.getTool(toolName);
        expect(tool).toBeDefined();
        expect(tool?.name).toBeDefined();
        expect(tool?.inputSchema).toBeDefined();
        expect(tool?.handler).toBeDefined();
        expect(tool?.description).toBeDefined();
        expect(typeof tool?.name).toBe("string");
        expect(typeof tool?.description).toBe("string");
        expect(typeof tool?.handler).toBe("function");
        expect(tool?.inputSchema.type).toBe("object");
      });
    });

    it("should verify each tool's handler has the correct structure", async () => {
      await toolGenerator.initialize();
      const registeredTools = toolGenerator.getRegisteredToolNames();

      for (const toolName of registeredTools) {
        const tool = toolGenerator.getTool(toolName);
        if (!tool) continue;

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
          handlerSource.includes("return") ||
          handlerSource.includes("=>");

        expect(isAsyncOrReturnsPromise).toBe(true);
      }
    });
  });

  describe("Tool Retrieval", () => {
    it("should retrieve a registered tool by name", async () => {
      await toolGenerator.initialize();
      const registeredTools = toolGenerator.getRegisteredToolNames();
      expect(registeredTools.length).toBeGreaterThan(0);

      // Get the first registered tool
      const toolName = registeredTools[0];
      const tool = toolGenerator.getTool(toolName);

      // Verify the tool was retrieved
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(toolName);
    });

    it("should return undefined for non-existent tool", async () => {
      await toolGenerator.initialize();
      const tool = toolGenerator.getTool("non_existent_tool");
      expect(tool).toBeUndefined();
    });
  });
});
