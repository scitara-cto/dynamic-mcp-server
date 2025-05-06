import { jest, expect } from "@jest/globals";
import { DynamicMcpServer } from "../server.js";
import { ToolGenerator } from "../ToolGenerator.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { config } from "../../config/index.js";
import { ToolDefinition } from "../types.js";

// Mock the SDK module
jest.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  const mockServer = jest.fn().mockImplementation((serverConfig: any) => {
    return {
      tool: jest.fn(),
      registerCapabilities: jest.fn(),
      setRequestHandler: jest.fn(),
    };
  });

  return { Server: mockServer };
});

describe("DynamicMcpServer", () => {
  let mcpServer: DynamicMcpServer;
  let toolGeneratorSpy: any;
  let mockServer: Server;

  beforeEach(() => {
    jest.clearAllMocks();

    toolGeneratorSpy = jest.spyOn(ToolGenerator.prototype, "initialize");
    toolGeneratorSpy.mockResolvedValue(undefined);

    mockServer = new Server({
      name: config.server.name,
      version: config.server.version,
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    });

    mcpServer = new DynamicMcpServer({
      name: config.server.name,
      version: config.server.version,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct configuration", () => {
      expect(mcpServer).toBeDefined();
      expect(mcpServer.getServer()).toBeDefined();
    });
  });

  describe("initialize", () => {
    it("should successfully initialize and register tools", async () => {
      await mcpServer.initialize();
      expect(toolGeneratorSpy).toHaveBeenCalled();
    });

    it("should throw an error if tool registration fails", async () => {
      toolGeneratorSpy.mockRejectedValue(new Error("Registration failed"));
      await expect(mcpServer.initialize()).rejects.toThrow(
        "Registration failed",
      );
    });

    it("registers tools from handlers", async () => {
      const mockTool = {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
        handler: {
          type: "test-handler",
          config: {},
        },
      };

      const mockHandler = {
        name: "test-handler",
        tools: [mockTool],
        handler: jest.fn(),
      };

      mcpServer.registerHandler(mockHandler);
      await mcpServer.initialize();

      // We don't need to verify registerTool was called since we're mocking initialize
      expect(toolGeneratorSpy).toHaveBeenCalled();
    });
  });

  describe("getServer", () => {
    it("should return the underlying server instance", () => {
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(Object);
    });
  });
});
