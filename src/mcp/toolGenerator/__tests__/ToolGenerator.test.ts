import { ToolGenerator } from "../ToolGenerator.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../server.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { ToolRepository } from "../../../db/repositories/ToolRepository.js";
import { ToolDefinition } from "../../types.js";
import { jest } from "@jest/globals";

describe("ToolGenerator", () => {
  let toolGenerator: ToolGenerator;
  let mockServer: Server;
  let mockMcpServer: DynamicMcpServer;
  let mockUserRepo: UserRepository;

  beforeEach(() => {
    mockServer = {
      setRequestHandler: jest.fn(),
      registerCapabilities: jest.fn(),
    } as any;
    mockMcpServer = {} as any;
    mockUserRepo = { findByEmail: jest.fn() } as any;
    toolGenerator = new ToolGenerator(mockServer, mockMcpServer, mockUserRepo);
  });

  it("should publish a tool and prevent duplicates", async () => {
    // Register a handler factory for 'test' type
    toolGenerator.registerHandlerFactory("test", () => async () => ({
      result: 1,
    }));
    const tool: ToolDefinition = {
      name: "unique-tool",
      description: "desc",
      inputSchema: {},
      handler: { type: "test", config: {} },
    };
    await toolGenerator.publishTool(tool);
    // Should not register duplicate
    await toolGenerator.publishTool(tool);
    const names = toolGenerator.getRegisteredToolNames();
    expect(names).toContain("unique-tool");
    expect(names.filter((n) => n === "unique-tool").length).toBe(1);
  });

  it("should wrap handler output for MCP protocol", async () => {
    // Register a handler factory
    toolGenerator.registerHandlerFactory("test", () => async () => ({
      result: 42,
      message: "ok",
    }));
    const tool: ToolDefinition = {
      name: "wrapped-tool",
      description: "desc",
      inputSchema: {},
      handler: { type: "test", config: {} },
    };
    await toolGenerator.publishTool(tool);
    const regTool = toolGenerator.getTool("wrapped-tool");
    expect(regTool).toBeDefined();
    const output = await regTool?.handler({}, {});
    expect(output).toHaveProperty("content");
    expect(JSON.stringify(output)).toContain("42");
  });

  it("should add a tool to the DB (calls ToolRepository.upsertMany)", async () => {
    // Register a handler factory for 'test' type
    toolGenerator.registerHandlerFactory("test", () => async () => ({
      result: 1,
    }));
    const tool: ToolDefinition = {
      name: "db-tool",
      description: "desc",
      inputSchema: {},
      handler: { type: "test", config: {} },
    };
    const upsertManyMock = jest
      .spyOn(ToolRepository.prototype, "upsertMany")
      .mockResolvedValue(undefined);
    await toolGenerator.addTool(tool, "user@example.com");
    expect(upsertManyMock).toHaveBeenCalledWith([
      { ...tool, creator: "user@example.com" },
    ]);
    upsertManyMock.mockRestore();
  });

  it("should throw if publishing a tool with unknown handler type", async () => {
    const tool: ToolDefinition = {
      name: "bad-tool",
      description: "desc",
      inputSchema: {},
      handler: { type: "unknown", config: {} },
    };
    await expect(toolGenerator.publishTool(tool)).rejects.toThrow(
      /Unknown handler type/,
    );
  });

  it("should remove a tool and update session tool sets", async () => {
    // Register a handler factory and tool
    toolGenerator.registerHandlerFactory("test", () => async () => ({
      result: 1,
    }));
    const tool: ToolDefinition = {
      name: "removable-tool",
      description: "desc",
      inputSchema: {},
      handler: { type: "test", config: {} },
    };
    await toolGenerator.publishTool(tool);
    // Simulate a session with this tool allowed
    (toolGenerator as any).sessionToolManager.updateSessionTools("sess1", {});
    expect(
      (toolGenerator as any).sessionToolManager.getAllowedTools("sess1"),
    ).toContain("removable-tool");
    await toolGenerator.removeTool("removable-tool");
    expect(
      (toolGenerator as any).sessionToolManager.getAllowedTools("sess1"),
    ).not.toContain("removable-tool");
  });

  it("should clean up session tool state", () => {
    (toolGenerator as any).sessionToolManager.updateSessionTools("sess2", {});
    expect(
      (toolGenerator as any).sessionToolManager.getAllowedTools("sess2"),
    ).toBeDefined();
    toolGenerator.cleanupSession("sess2");
    expect(
      (toolGenerator as any).sessionToolManager.getAllowedTools("sess2"),
    ).toBeUndefined();
  });

  it("should wrap handler errors as MCP error responses", async () => {
    toolGenerator.registerHandlerFactory("err", () => async () => {
      throw new Error("fail");
    });
    const tool: ToolDefinition = {
      name: "error-tool",
      description: "desc",
      inputSchema: {},
      handler: { type: "err", config: {} },
    };
    await toolGenerator.publishTool(tool);
    const regTool = toolGenerator.getTool("error-tool");
    const output = await regTool?.handler({}, {});
    expect(output).toHaveProperty("isError", true);
    expect(JSON.stringify(output)).toContain("fail");
  });
});
