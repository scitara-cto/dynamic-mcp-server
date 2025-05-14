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
  let mockToolGenerator: any;

  beforeAll(() => {
    jest.spyOn(ToolRepository.prototype, "findAll").mockResolvedValue([
      {
        name: "foo",
        description: "",
        rolesPermitted: ["admin"],
        creator: "system",
      },
      {
        name: "bar",
        description: "",
        rolesPermitted: ["admin"],
        creator: "system",
      },
      {
        name: "baz",
        description: "",
        rolesPermitted: ["admin"],
        creator: "system",
      },
    ]);
  });

  beforeEach(() => {
    handler = new ToolManagementHandler();
    mockToolGenerator = {
      getTool: jest.fn(),
      removeTool: jest.fn(),
      getRegisteredToolNames: jest.fn(),
    };
    mockContext = {
      mcpServer: {
        toolGenerator: mockToolGenerator,
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
        mockToolGenerator.getTool.mockReturnValue({ name: "foo" });
        mockToolGenerator.removeTool.mockResolvedValue();
        const result = await handler.handler({ name: "foo" }, mockContext, {
          action: "delete",
        });
        expect(result.result.success).toBe(true);
        expect(result.result.name).toBe("foo");
        expect(result.message).toMatch(/deleted successfully/);
        expect(mockToolGenerator.removeTool).toHaveBeenCalledWith("foo");
      });

      it("throws if tool name is missing", async () => {
        await expect(
          handler.handler({}, mockContext, { action: "delete" }),
        ).rejects.toThrow(/Tool name is required/);
      });

      it("throws if tool not found", async () => {
        mockToolGenerator.getTool.mockReturnValue(undefined);
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
        mockToolGenerator.getTool.mockReturnValue({ name: "foo" });
        mockToolGenerator.removeTool.mockRejectedValue(new Error("DB error"));
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
          },
          {
            name: "foo",
            description: "",
            rolesPermitted: ["admin"],
            creator: "system",
          },
          {
            name: "bar",
            description: "",
            rolesPermitted: ["admin"],
            creator: "system",
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
      expect(tools).toHaveLength(3);
      expect(tools[0].name).toBe("list-tools");
      expect(tools[1].name).toBe("delete-tool");
      expect(tools[2].name).toBe("use-tools");
    });
  });
});
