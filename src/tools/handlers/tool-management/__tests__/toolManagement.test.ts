import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { handleDeleteToolAction } from "../deleteToolAction.js";
import { handleListToolsAction } from "../listToolsAction.js";
import { toolManagementHandler } from "../index.js";

describe("toolManagement action handlers", () => {
  let mockContext: any;
  let mockToolGenerator: any;

  beforeEach(() => {
    mockToolGenerator = {
      getTool: jest.fn(),
      removeTool: jest.fn(),
      getRegisteredToolNames: jest.fn(),
    };
    mockContext = {
      mcpServer: {
        toolGenerator: mockToolGenerator,
      },
    };
  });

  describe("handleDeleteToolAction", () => {
    it("deletes a tool successfully", async () => {
      mockToolGenerator.getTool.mockReturnValue({ name: "foo" });
      mockToolGenerator.removeTool.mockResolvedValue();
      const result = await handleDeleteToolAction(
        { name: "foo" },
        mockContext,
        { action: "delete" },
      );
      expect(result.result.success).toBe(true);
      expect(result.result.name).toBe("foo");
      expect(result.message).toMatch(/deleted successfully/);
      expect(mockToolGenerator.removeTool).toHaveBeenCalledWith("foo");
    });
    it("throws if tool name is missing", async () => {
      await expect(
        handleDeleteToolAction({}, mockContext, { action: "delete" }),
      ).rejects.toThrow(/Tool name is required/);
    });
    it("throws if tool not found", async () => {
      mockToolGenerator.getTool.mockReturnValue(undefined);
      await expect(
        handleDeleteToolAction({ name: "bar" }, mockContext, {
          action: "delete",
        }),
      ).rejects.toThrow(/not found/);
    });
    it("throws if mcpServer missing", async () => {
      await expect(
        handleDeleteToolAction(
          { name: "foo" },
          { token: "", user: {} },
          { action: "delete" },
        ),
      ).rejects.toThrow(/McpServer not available/);
    });
  });

  describe("handleListToolsAction", () => {
    it("lists all tools", async () => {
      mockToolGenerator.getRegisteredToolNames.mockReturnValue(["foo", "bar"]);
      const result = await handleListToolsAction({}, mockContext, {
        action: "list",
      });
      expect(result.result.tools).toEqual(["foo", "bar"]);
      expect(result.result.total).toBe(2);
      expect(result.result.filtered).toBe(false);
    });
    it("filters tools by nameContains", async () => {
      mockToolGenerator.getRegisteredToolNames.mockReturnValue([
        "foo",
        "bar",
        "baz",
      ]);
      const result = await handleListToolsAction(
        { nameContains: "ba" },
        mockContext,
        { action: "list" },
      );
      expect(result.result.tools).toEqual(["bar", "baz"]);
      expect(result.result.filtered).toBe(true);
    });
    it("throws if mcpServer missing", async () => {
      await expect(
        handleListToolsAction({}, { token: "", user: {} }, { action: "list" }),
      ).rejects.toThrow(/McpServer not available/);
    });
  });

  describe("toolManagementHandler", () => {
    it("delegates to delete action", async () => {
      mockToolGenerator.getTool.mockReturnValue({ name: "foo" });
      mockToolGenerator.removeTool.mockResolvedValue();
      const result = await toolManagementHandler({ name: "foo" }, mockContext, {
        action: "delete",
      });
      expect(result.result.success).toBe(true);
    });
    it("delegates to list action", async () => {
      mockToolGenerator.getRegisteredToolNames.mockReturnValue(["foo"]);
      const result = await toolManagementHandler({}, mockContext, {
        action: "list",
      });
      expect(result.result.tools).toEqual(["foo"]);
    });
    it("throws on unknown action", async () => {
      await expect(
        toolManagementHandler({}, mockContext, { action: "unknown" }),
      ).rejects.toThrow(/Unknown action/);
    });
  });
});
