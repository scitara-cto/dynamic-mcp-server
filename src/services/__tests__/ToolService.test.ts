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
    mockUserRepo = { findByEmail: jest.fn() } as any;
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
});
