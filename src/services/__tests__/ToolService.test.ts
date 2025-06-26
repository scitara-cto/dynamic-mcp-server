import { ToolService } from "../ToolService.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { ToolRepository } from "../../db/repositories/ToolRepository.js";
import { ToolDefinition } from "../../mcp/types.js";
import { jest } from "@jest/globals";

describe("ToolService", () => {
  let toolService: ToolService;
  let mockServer: Server;
  let mockMcpServer: DynamicMcpServer;
  let mockUserRepo: UserRepository;

  beforeEach(() => {
    mockServer = {
      setRequestHandler: jest.fn(),
      registerCapabilities: jest.fn(),
    } as any;
    mockMcpServer = {} as any;
    mockUserRepo = {
      findByEmail: jest.fn(),
      getUserTools: jest.fn()
    } as any;
    toolService = new ToolService(mockServer, mockMcpServer, mockUserRepo);
  });

  it("should add a tool to the DB (calls ToolRepository.upsertMany)", async () => {
    const tool: ToolDefinition = {
      name: "db-tool",
      description: "desc",
      inputSchema: { type: "object", properties: {} },
      handler: { type: "test", config: {} },
    };
    const upsertManyMock = jest
      .spyOn(ToolRepository.prototype, "upsertMany")
      .mockResolvedValue(undefined);
    await toolService.addTool(tool, "user@example.com");
    expect(upsertManyMock).toHaveBeenCalledWith([
      { ...tool, creator: "user@example.com" },
    ]);
    upsertManyMock.mockRestore();
  });

  it("should provide a no-op progress function if no token or sessionId", () => {
    const progressFn = (toolService as any).createProgressFunction(
      undefined,
      undefined,
    );
    expect(typeof progressFn).toBe("function");
    expect(progressFn(10, 100, "msg")).toBeNull();
  });

  it("should send progress notification if token and sessionId are provided", () => {
    const mockSend = jest.fn();
    (toolService as any).mcpServer = { sendNotificationToSession: mockSend };
    const progressFn = (toolService as any).createProgressFunction(
      "mysession",
      "ptoken",
    );
    progressFn(42, 100, "Halfway");
    expect(mockSend).toHaveBeenCalledWith("mysession", {
      method: "notifications/progress",
      params: {
        progressToken: "ptoken",
        progress: 42,
        total: 100,
        message: "Halfway",
      },
    });
  });

  it("handler can call progress function during tool execution", async () => {
    const mockSend = jest.fn();
    const fakeHandler = jest.fn((args: any, context: any, config: any) => {
      if (context.progress) context.progress(5, 10, "step");
      return { result: "ok" };
    });
    (toolService as any).mcpServer = {
      sendNotificationToSession: mockSend,
      getHandler: () => fakeHandler,
    };
    const toolDef = {
      name: "mytool",
      handler: { type: "fake", config: {} },
    };
    const context = {
      user: { email: "a@b.com" },
      progress: (toolService as any).createProgressFunction(
        "mysession",
        "ptoken",
      ),
    };
    // Mock getUserTools to return the tool
    jest.spyOn(mockUserRepo, 'getUserTools').mockResolvedValue([{
      name: "mytool",
      creator: "a@b.com",
      handler: { type: "fake", config: {} },
      description: "Test tool",
      inputSchema: { type: "object", properties: {} }
    }] as any);
    
    
    jest
      .spyOn(toolService as any, "authorizeToolCall")
      .mockResolvedValue({ authorized: true });
    await toolService.executeTool(toolDef, {}, context, context.progress);
    expect(fakeHandler).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith(
      "mysession",
      expect.objectContaining({ method: "notifications/progress" }),
    );
  });
});
