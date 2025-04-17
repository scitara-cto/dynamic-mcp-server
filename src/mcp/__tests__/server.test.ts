import { jest, expect } from "@jest/globals";
import { McpServer } from "../server.js";
import { ToolGenerator } from "../../tools/index.js";

// Mock the SDK module
jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  const mockServer = jest.fn().mockImplementation((serverConfig: any) => {
    return {
      tool: jest.fn(),
    };
  });

  return { McpServer: mockServer };
});

describe("McpServer", () => {
  let mcpServer: McpServer;
  let toolGeneratorSpy: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    toolGeneratorSpy = jest.spyOn(ToolGenerator.prototype, "registerAllTools");
    toolGeneratorSpy.mockResolvedValue(2);

    mcpServer = new McpServer();
    await mcpServer.initialize();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct configuration", () => {
      expect(mcpServer).toBeDefined();
      expect(mcpServer["server"]).toBeDefined();
    });
  });

  describe("initialize", () => {
    it("should successfully initialize and register tools", async () => {
      await mcpServer.initialize();
      expect(toolGeneratorSpy).toHaveBeenCalled();
      expect(toolGeneratorSpy).toHaveReturnedWith(Promise.resolve(2));
    });

    it("should throw an error if tool registration fails", async () => {
      toolGeneratorSpy.mockRejectedValue(new Error("Registration failed"));
      await expect(mcpServer.initialize()).rejects.toThrow(
        "Registration failed",
      );
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
