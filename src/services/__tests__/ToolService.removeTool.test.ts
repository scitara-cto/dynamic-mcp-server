import { jest } from "@jest/globals";
import { ToolService } from "../ToolService.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { ToolRepository } from "../../db/repositories/ToolRepository.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

describe("ToolService.removeTool", () => {
  let toolService: ToolService;
  let mockUserRepository: UserRepository;
  let mockMcpServer: DynamicMcpServer;
  let mockServer: Server;
  let findByNameSpy: jest.SpiedFunction<(name: string) => Promise<any>>;
  let findByNameAndCreatorSpy: jest.SpiedFunction<(name: string, creator: string) => Promise<any>>;
  let findByNamespacedNameSpy: jest.SpiedFunction<(namespacedName: string) => Promise<any>>;
  let deleteToolSpy: jest.SpiedFunction<(name: string) => Promise<void>>;
  let removeToolFromHiddenToolsSpy: jest.SpiedFunction<(toolName: string, toolCreator: string, rolesPermitted?: string[]) => Promise<void>>;

  beforeEach(() => {
    mockServer = {
      setRequestHandler: jest.fn(),
    } as any;
    mockMcpServer = {} as any;
    mockUserRepository = {
      removeToolFromHiddenToolsForAuthorizedUsers: jest.fn(),
    } as any;

    toolService = new ToolService(mockServer, mockMcpServer, mockUserRepository);

    // Spy on ToolRepository.prototype methods
    findByNameSpy = jest.spyOn(ToolRepository.prototype, "findByName");
    findByNameAndCreatorSpy = jest.spyOn(ToolRepository.prototype, "findByNameAndCreator");
    findByNamespacedNameSpy = jest.spyOn(ToolRepository.prototype, "findByNamespacedName");
    deleteToolSpy = jest.spyOn(ToolRepository.prototype, "deleteTool").mockResolvedValue(undefined);
    
    // Spy on UserRepository.removeToolFromHiddenToolsForAuthorizedUsers
    removeToolFromHiddenToolsSpy = jest.spyOn(mockUserRepository, "removeToolFromHiddenToolsForAuthorizedUsers").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should remove tool by name and creator", async () => {
    const toolName = "test-tool";
    const creator = "creator@example.com";
    const mockTool = {
      name: toolName,
      creator: creator,
      rolesPermitted: ["admin", "user"],
      description: "Test tool",
      inputSchema: {},
      handler: { type: "test", config: {} }
    };

    findByNameAndCreatorSpy.mockResolvedValue(mockTool);

    await toolService.removeTool(toolName, creator);

    expect(findByNameAndCreatorSpy).toHaveBeenCalledWith(toolName, creator);
    expect(deleteToolSpy).toHaveBeenCalledWith(toolName);
    expect(removeToolFromHiddenToolsSpy).toHaveBeenCalledWith(
      mockTool.name,
      mockTool.creator,
      mockTool.rolesPermitted
    );
  });

  it("should remove tool by namespaced name", async () => {
    const namespacedName = "creator@example.com:test-tool";
    const mockTool = {
      name: "test-tool",
      creator: "creator@example.com",
      rolesPermitted: ["admin"],
      description: "Test tool",
      inputSchema: {},
      handler: { type: "test", config: {} }
    };

    findByNamespacedNameSpy.mockResolvedValue(mockTool);

    await toolService.removeTool(namespacedName);

    expect(findByNamespacedNameSpy).toHaveBeenCalledWith(namespacedName);
    expect(deleteToolSpy).toHaveBeenCalledWith(namespacedName);
    expect(removeToolFromHiddenToolsSpy).toHaveBeenCalledWith(
      mockTool.name,
      mockTool.creator,
      mockTool.rolesPermitted
    );
  });

  it("should fallback to findByName for backward compatibility", async () => {
    const toolName = "test-tool";
    const mockTool = {
      name: toolName,
      creator: "creator@example.com",
      rolesPermitted: ["user"],
      description: "Test tool",
      inputSchema: {},
      handler: { type: "test", config: {} }
    };

    findByNameSpy.mockResolvedValue(mockTool);

    await toolService.removeTool(toolName);

    expect(findByNameSpy).toHaveBeenCalledWith(toolName);
    expect(deleteToolSpy).toHaveBeenCalledWith(toolName);
    expect(removeToolFromHiddenToolsSpy).toHaveBeenCalledWith(
      mockTool.name,
      mockTool.creator,
      mockTool.rolesPermitted
    );
  });

  it("should handle tool not found", async () => {
    const toolName = "nonexistent-tool";
    
    findByNameSpy.mockResolvedValue(null);

    await expect(toolService.removeTool(toolName)).rejects.toThrow("Tool with name 'nonexistent-tool' not found");
    
    expect(findByNameSpy).toHaveBeenCalledWith(toolName);
    expect(deleteToolSpy).not.toHaveBeenCalled();
    expect(removeToolFromHiddenToolsSpy).not.toHaveBeenCalled();
  });

  it("should handle tool deletion failure gracefully", async () => {
    const toolName = "test-tool";
    const mockTool = {
      name: toolName,
      creator: "creator@example.com",
      rolesPermitted: ["admin"],
      description: "Test tool",
      inputSchema: {},
      handler: { type: "test", config: {} }
    };
    const error = new Error("Database error during deletion");
    
    findByNameSpy.mockResolvedValue(mockTool);
    deleteToolSpy.mockRejectedValue(error);

    await expect(toolService.removeTool(toolName)).rejects.toThrow("Database error during deletion");
    
    expect(findByNameSpy).toHaveBeenCalledWith(toolName);
    expect(deleteToolSpy).toHaveBeenCalledWith(toolName);
    // Should not call removeToolFromHiddenToolsForAuthorizedUsers if deleteTool fails
    expect(removeToolFromHiddenToolsSpy).not.toHaveBeenCalled();
  });

  it("should handle hiddenTools cleanup failure gracefully", async () => {
    const toolName = "test-tool";
    const mockTool = {
      name: toolName,
      creator: "creator@example.com",
      rolesPermitted: ["user"],
      description: "Test tool",
      inputSchema: {},
      handler: { type: "test", config: {} }
    };
    const error = new Error("Database connection failed");
    
    findByNameSpy.mockResolvedValue(mockTool);
    deleteToolSpy.mockResolvedValue(undefined);
    removeToolFromHiddenToolsSpy.mockRejectedValue(error);

    await expect(toolService.removeTool(toolName)).rejects.toThrow("Database connection failed");
    
    expect(findByNameSpy).toHaveBeenCalledWith(toolName);
    expect(deleteToolSpy).toHaveBeenCalledWith(toolName);
    expect(removeToolFromHiddenToolsSpy).toHaveBeenCalledWith(
      mockTool.name,
      mockTool.creator,
      mockTool.rolesPermitted
    );
  });

  it("should validate tool names don't contain colon", async () => {
    const toolDef = {
      name: "invalid:tool-name",
      description: "Test tool",
      inputSchema: { type: "object" as const, properties: {} },
      handler: { type: "test", config: {} }
    };

    await expect(toolService.addTool(toolDef)).rejects.toThrow("Tool names cannot contain ':' character");
  });
});