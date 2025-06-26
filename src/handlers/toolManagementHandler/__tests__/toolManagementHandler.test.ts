import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
} from "@jest/globals";
import { toolManagementHandlerPackage } from "../index.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";

describe("toolManagementHandlerPackage.handler", () => {
  const handler = toolManagementHandlerPackage.handler;
  let mockContext: any;
  let mockToolService: any;
  let getUserToolsSpy;

  beforeAll(() => {
    getUserToolsSpy = jest
      .spyOn(UserRepository.prototype, "getUserTools")
      .mockResolvedValue([
        { name: "foo", description: "", hidden: false },
        { name: "bar", description: "", hidden: false },
        { name: "baz", description: "", hidden: false },
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
          { name: "foo", description: "", hidden: false },
          { name: "bar", description: "", hidden: false },
          { name: "baz", description: "", hidden: false },
        ]);
        expect(result.result.total).toBe(3);
        expect(result.result.filtered).toBe(false);
      });

      it("filters tools by nameContains", async () => {
        getUserToolsSpy.mockResolvedValue([
          { name: "bar", description: "", hidden: false },
          { name: "baz", description: "", hidden: false },
        ]);
        const result = await handler({ nameContains: "ba" }, mockContext, {
          action: "list",
        });
        expect(result.result.visibleTools).toEqual([
          { name: "bar", description: "", hidden: false },
          { name: "baz", description: "", hidden: false },
        ]);
        expect(result.result.filtered).toBe(true);
      });

      it("throws if mcpServer missing", async () => {
        await expect(
          handler({}, { token: "", user: {} }, { action: "list" }),
        ).rejects.toThrow(/McpServer not available/);
      });

      it("returns an empty list if no tools are registered", async () => {
        getUserToolsSpy.mockResolvedValue([]);
        const result = await handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.visibleTools).toEqual([]);
        expect(result.result.total).toBe(0);
        expect(result.result.filtered).toBe(false);
      });

      it("handles duplicate tool names gracefully", async () => {
        getUserToolsSpy.mockResolvedValue([
          { name: "foo", description: "", hidden: false },
          { name: "foo", description: "", hidden: false },
          { name: "bar", description: "", hidden: false },
        ]);
        const result = await handler({}, mockContext, {
          action: "list",
        });
        expect(result.result.visibleTools).toEqual([
          { name: "foo", description: "", hidden: false },
          { name: "foo", description: "", hidden: false },
          { name: "bar", description: "", hidden: false },
        ]);
        expect(result.result.total).toBe(3);
      });

      it("warns about tools with duplicate base names", async () => {
        getUserToolsSpy.mockResolvedValue([
          {
            name: "list-users",
            namespacedName: "user-management:list-users",
            description: "Built-in user management tool",
            hidden: false
          },
          {
            name: "list-users",
            namespacedName: "my-app:list-users",
            description: "Custom user listing tool",
            hidden: false
          },
          {
            name: "unique-tool",
            namespacedName: "user@example.com:unique-tool",
            description: "A unique tool",
            hidden: false
          },
        ]);
        const result = await handler({}, mockContext, {
          action: "list",
        });
        
        expect(result.result.duplicateBaseNames).toEqual([
          {
            baseName: "list-users",
            namespacedNames: ["user-management:list-users", "my-app:list-users"]
          }
        ]);
        expect(result.message).toContain("⚠️  WARNING: You have tools with duplicate base names");
        expect(result.message).toContain('"list-users" (user-management:list-users, my-app:list-users)');
        expect(result.message).toContain("the system will prioritize your own tools over shared tools");
      });

      it("does not warn when no duplicate base names exist", async () => {
        getUserToolsSpy.mockResolvedValue([
          {
            name: "list-users",
            namespacedName: "user-management:list-users",
            description: "Built-in user management tool",
            hidden: false
          },
          {
            name: "delete-tool",
            namespacedName: "tool-management:delete-tool",
            description: "Built-in tool management",
            hidden: false
          },
        ]);
        const result = await handler({}, mockContext, {
          action: "list",
        });
        
        expect(result.result.duplicateBaseNames).toBeUndefined();
        expect(result.message).not.toContain("⚠️  WARNING");
        expect(result.message).not.toContain("duplicate base names");
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
