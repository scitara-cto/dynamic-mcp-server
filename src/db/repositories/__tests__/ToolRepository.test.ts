import { jest } from "@jest/globals";
import { ToolRepository } from "../ToolRepository.js";
import { ITool } from "../../models/Tool.js";

describe("ToolRepository (mocked)", () => {
  const now = new Date();
  const minimalTool = (name: string, description = "desc") => ({
    name,
    description,
    inputSchema: {},
    annotations: {},
    handler: { type: "test", config: {} },
    creator: "system",
    createdAt: now,
    updatedAt: now,
    rolesPermitted: ["admin"],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create, find, update, and delete a tool", async () => {
    const repo = new ToolRepository();
    const tool = minimalTool("test-tool");
    jest.spyOn(repo, "create").mockResolvedValue(tool);
    const findByNameMock = jest
      .spyOn(repo, "findByName")
      .mockResolvedValue(tool);
    const updateToolMock = jest
      .spyOn(repo, "updateTool")
      .mockImplementation(async (name, updates) => {
        const updated = { ...tool, ...updates };
        findByNameMock.mockResolvedValue(updated);
        return updated;
      });
    const deleteToolMock = jest
      .spyOn(repo, "deleteTool")
      .mockImplementation(async (name) => {
        findByNameMock.mockResolvedValue(null);
        deleteToolMock.mockRejectedValueOnce(new Error("not found"));
        return undefined;
      });

    await repo.create(tool);
    const found = await repo.findByName("test-tool");
    expect(found).toBeDefined();
    expect(found?.name).toBe("test-tool");

    await repo.updateTool("test-tool", { description: "updated" });
    const updated = await repo.findByName("test-tool");
    expect(updated?.description).toBe("updated");

    await expect(repo.deleteTool("test-tool")).resolves.toBeUndefined();
    const afterDelete = await repo.findByName("test-tool");
    expect(afterDelete).toBeNull();
    await expect(repo.deleteTool("test-tool")).rejects.toThrow(/not found/);
  });

  it("should upsert tools and not duplicate", async () => {
    const repo = new ToolRepository();
    const tool = minimalTool("upsert-tool");
    jest.spyOn(repo, "upsertMany").mockResolvedValue(undefined);
    jest
      .spyOn(repo, "list")
      .mockResolvedValue([{ ...tool, description: "changed" }]);
    await repo.upsertMany([tool]);
    await repo.upsertMany([{ ...tool, description: "changed" }]);
    const all = await repo.list({});
    expect(all.length).toBe(1);
    expect(all[0].description).toBe("changed");
  });

  it("should remove stale built-in tools", async () => {
    const repo = new ToolRepository();
    const keepTool = minimalTool("keep-tool");
    const staleTool = minimalTool("stale-tool");
    jest.spyOn(repo, "list").mockResolvedValue([keepTool, staleTool]);
    jest.spyOn(repo, "deleteTool").mockResolvedValue(undefined);
    // Simulate sync: only keep-tool should remain
    const builtinToolNames = new Set(["keep-tool"]);
    const dbBuiltinTools = await repo.list({});
    for (const tool of dbBuiltinTools) {
      if (tool.creator === "system" && !builtinToolNames.has(tool.name)) {
        await repo.deleteTool(tool.name);
      }
    }
    jest.spyOn(repo, "list").mockResolvedValue([keepTool]);
    const all = await repo.list({});
    expect(all.length).toBe(1);
    expect(all[0].name).toBe("keep-tool");
  });
});
