import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
} from "@jest/globals";
import { toolManagementHandlerPackage } from "../index.js";
import { ToolRepository } from "../../../db/repositories/ToolRepository.js";

describe("toolManagementHandlerPackage.handler", () => {
  const handler = toolManagementHandlerPackage.handler;
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
    mockToolService = {
      removeTool: jest.fn(),
      updateTool: jest.fn(),
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
        hiddenTools: [],
      },
    };
    jest.clearAllMocks();
  });

  describe("handle", () => {
    describe("delete action", () => {
      it("deletes a tool successfully", async () => {
        const result = await handler({ name: "foo" }, mockContext, {
          action: "delete",
        });
        expect(result.result.success).toBe(true);
        expect(result.result.name).toBe("foo");
        expect(result.message).toMatch(/deleted successfully/);
        expect(mockToolService.removeTool).toHaveBeenCalledWith("foo");
      });

      it("throws if tool name is missing", async () => {
        await expect(
          handler({}, mockContext, { action: "delete" }),
        ).rejects.toThrow(/Tool name is required/);
      });

      it("throws if tool not found", async () => {
        mockToolService.removeTool.mockImplementation(async (name: string) => {
          if (name === "bar") throw new Error("Tool with name 'bar' not found");
        });
        await expect(
          handler({ name: "bar" }, mockContext, { action: "delete" }),
        ).rejects.toThrow(/not found/);
      });

      it("throws if mcpServer missing", async () => {
        await expect(
          handler(
            { name: "foo" },
            { token: "", user: {} },
            { action: "delete" },
          ),
        ).rejects.toThrow(/McpServer not available/);
      });

      it("throws if removeTool throws an error", async () => {
        mockToolService.removeTool.mockRejectedValue(new Error("DB error"));
        await expect(
          handler({ name: "foo" }, mockContext, { action: "delete" }),
        ).rejects.toThrow(/DB error/);
      });
    });

    describe("update action", () => {
      beforeEach(() => {
        mockToolService.updateTool = jest.fn();
      });

      it("updates a tool successfully", async () => {
        mockToolService.updateTool.mockResolvedValue({
          name: "foo",
          description: "updated",
        });
        const result = await handler(
          { name: "foo", updates: { description: "updated" } },
          mockContext,
          {
            action: "update",
          },
        );
        expect(result.result.success).toBe(true);
        expect(result.result.name).toBe("foo");
        expect(result.result.updated).toEqual({
          name: "foo",
          description: "updated",
        });
        expect(result.message).toMatch(/updated successfully/);
        expect(mockToolService.updateTool).toHaveBeenCalledWith("foo", {
          description: "updated",
        });
        expect(mockContext.mcpServer.notifyToolListChanged).toHaveBeenCalled();
      });

      it("throws if tool name is missing", async () => {
        await expect(
          handler({ updates: { description: "updated" } }, mockContext, {
            action: "update",
          }),
        ).rejects.toThrow(/tool name/i);
      });

      it("throws if updates object is missing", async () => {
        await expect(
          handler({ name: "foo" }, mockContext, { action: "update" }),
        ).rejects.toThrow(/updates object/i);
      });

      it("throws if mcpServer missing", async () => {
        await expect(
          handler(
            { name: "foo", updates: { description: "updated" } },
            { token: "", user: {} },
            { action: "update" },
          ),
        ).rejects.toThrow(/McpServer not available/);
      });

      it("throws if updateTool throws an error", async () => {
        mockToolService.updateTool.mockRejectedValue(new Error("DB error"));
        await expect(
          handler(
            { name: "foo", updates: { description: "updated" } },
            mockContext,
            { action: "update" },
          ),
        ).rejects.toThrow(/DB error/);
      });
    });

    describe("list action", () => {
      it("lists all tools", async () => {
        const result = await handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.visibleTools).toEqual([
          { name: "foo", description: "", available: true, hidden: false },
          { name: "bar", description: "", available: true, hidden: false },
          { name: "baz", description: "", available: true, hidden: false },
        ]);
        expect(result.result.total).toBe(3);
        expect(result.result.filtered).toBe(false);
      });

      it("filters tools by nameContains", async () => {
        const result = await handler({ nameContains: "ba" }, mockContext, {
          action: "list",
        });
        expect(result.result.visibleTools).toEqual([
          { name: "bar", description: "", available: true, hidden: false },
          { name: "baz", description: "", available: true, hidden: false },
        ]);
        expect(result.result.filtered).toBe(true);
      });

      it("throws if mcpServer missing", async () => {
        await expect(
          handler({}, { token: "", user: {} }, { action: "list" }),
        ).rejects.toThrow(/McpServer not available/);
      });

      it("returns an empty list if no tools are registered", async () => {
        jest.spyOn(ToolRepository.prototype, "findAll").mockResolvedValue([]);
        const result = await handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.visibleTools).toEqual([]);
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
        const result = await handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.visibleTools).toEqual([
          { name: "foo", description: "", available: true, hidden: false },
          { name: "foo", description: "", available: true, hidden: false },
          { name: "bar", description: "", available: true, hidden: false },
        ]);
        expect(result.result.total).toBe(3);
      });
    });

    it("throws on unknown action", async () => {
      await expect(
        handler({}, mockContext, { action: "unknown" }),
      ).rejects.toThrow(/Unknown action/);
    });
  });

  describe("registerTools", () => {
    it("returns the tool management tools", () => {
      const tools = toolManagementHandlerPackage.tools;
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
