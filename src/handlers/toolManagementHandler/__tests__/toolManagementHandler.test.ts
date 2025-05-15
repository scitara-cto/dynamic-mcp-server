import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
} from "@jest/globals";
import { ToolManagementHandler } from "../index.js";
import { ToolRepository } from "../../../db/repositories/ToolRepository.js";

describe("ToolManagementHandler", () => {
  let handler: ToolManagementHandler;
  let mockContext: any;
  let mockToolService: any;

  beforeAll(() => {
    jest.spyOn(ToolRepository.prototype, "findAll").mockResolvedValue([
      {
        name: "foo",
        description: "",
        rolesPermitted: ["admin"],
        creator: "system",
        inputSchema: {},
        handler: { type: "test", config: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "bar",
        description: "",
        rolesPermitted: ["admin"],
        creator: "system",
        inputSchema: {},
        handler: { type: "test", config: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "baz",
        description: "",
        rolesPermitted: ["admin"],
        creator: "system",
        inputSchema: {},
        handler: { type: "test", config: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  beforeEach(() => {
    handler = new ToolManagementHandler();
    mockToolService = {
      removeTool: jest.fn(),
    };
    mockContext = {
      mcpServer: {
        toolService: mockToolService,
        notifyToolListChanged: jest.fn(),
      },
      user: {
        email: "test@example.com",
        roles: ["admin"],
        sharedTools: [],
        usedTools: [],
      },
    };
    jest.clearAllMocks();
  });

  describe("handle", () => {
    describe("delete action", () => {
      it("deletes a tool successfully", async () => {
        const result = await handler.handler({ name: "foo" }, mockContext, {
          action: "delete",
        });
        expect(result.result.success).toBe(true);
        expect(result.result.name).toBe("foo");
        expect(result.message).toMatch(/deleted successfully/);
        expect(mockToolService.removeTool).toHaveBeenCalledWith("foo");
      });

      it("throws if tool name is missing", async () => {
        await expect(
          handler.handler({}, mockContext, { action: "delete" }),
        ).rejects.toThrow(/Tool name is required/);
      });

      it("throws if tool not found", async () => {
        mockToolService.removeTool.mockImplementation(async (name: string) => {
          if (name === "bar") throw new Error("Tool with name 'bar' not found");
        });
        await expect(
          handler.handler({ name: "bar" }, mockContext, { action: "delete" }),
        ).rejects.toThrow(/not found/);
      });

      it("throws if mcpServer missing", async () => {
        await expect(
          handler.handler(
            { name: "foo" },
            { token: "", user: {} },
            { action: "delete" },
          ),
        ).rejects.toThrow(/McpServer not available/);
      });

      it("throws if removeTool throws an error", async () => {
        mockToolService.removeTool.mockRejectedValue(new Error("DB error"));
        await expect(
          handler.handler({ name: "foo" }, mockContext, { action: "delete" }),
        ).rejects.toThrow(/DB error/);
      });
    });

    describe("list action", () => {
      it("lists all tools", async () => {
        const result = await handler.handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.availableTools).toEqual([
          { name: "foo", description: "", available: true, inUse: false },
          { name: "bar", description: "", available: true, inUse: false },
          { name: "baz", description: "", available: true, inUse: false },
        ]);
        expect(result.result.total).toBe(3);
        expect(result.result.filtered).toBe(false);
      });

      it("filters tools by nameContains", async () => {
        const result = await handler.handler(
          { nameContains: "ba" },
          mockContext,
          { action: "list" },
        );
        expect(result.result.availableTools).toEqual([
          { name: "bar", description: "", available: true, inUse: false },
          { name: "baz", description: "", available: true, inUse: false },
        ]);
        expect(result.result.filtered).toBe(true);
      });

      it("throws if mcpServer missing", async () => {
        await expect(
          handler.handler({}, { token: "", user: {} }, { action: "list" }),
        ).rejects.toThrow(/McpServer not available/);
      });

      it("returns an empty list if no tools are registered", async () => {
        jest.spyOn(ToolRepository.prototype, "findAll").mockResolvedValue([]);
        const result = await handler.handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.availableTools).toEqual([]);
        expect(result.result.total).toBe(0);
        expect(result.result.filtered).toBe(false);
      });

      it("handles duplicate tool names gracefully", async () => {
        jest.spyOn(ToolRepository.prototype, "findAll").mockResolvedValue([
          {
            name: "foo",
            description: "",
            rolesPermitted: ["admin"],
            creator: "system",
            inputSchema: {},
            handler: { type: "test", config: {} },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            name: "foo",
            description: "",
            rolesPermitted: ["admin"],
            creator: "system",
            inputSchema: {},
            handler: { type: "test", config: {} },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            name: "bar",
            description: "",
            rolesPermitted: ["admin"],
            creator: "system",
            inputSchema: {},
            handler: { type: "test", config: {} },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
        const result = await handler.handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.availableTools).toEqual([
          { name: "foo", description: "", available: true, inUse: false },
          { name: "foo", description: "", available: true, inUse: false },
          { name: "bar", description: "", available: true, inUse: false },
        ]);
        expect(result.result.total).toBe(3);
      });
    });

    it("throws on unknown action", async () => {
      await expect(
        handler.handler({}, mockContext, { action: "unknown" }),
      ).rejects.toThrow(/Unknown action/);
    });
  });

  describe("registerTools", () => {
    it("returns the tool management tools", () => {
      const tools = handler.tools;
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThanOrEqual(2); // At least the core tools
      // Check for presence of key tools
      expect(tools.some((t) => t.name === "list-tools")).toBe(true);
      expect(tools.some((t) => t.name === "delete-tool")).toBe(true);
      // Check that each tool has required properties
      tools.forEach((tool) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("handler");
        expect(tool).toHaveProperty("inputSchema");
      });
    });
  });
});
