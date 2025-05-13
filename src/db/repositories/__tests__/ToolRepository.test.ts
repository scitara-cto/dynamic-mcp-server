import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { ToolRepository } from "../ToolRepository.js";
import { Tool, ITool } from "../../models/Tool.js";

describe("ToolRepository", () => {
  let mongoServer: MongoMemoryServer;
  let repo: ToolRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), { dbName: "test" });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Tool.deleteMany({});
    repo = new ToolRepository();
  });

  it("should create, find, update, and delete a tool", async () => {
    const tool: Partial<ITool> = {
      name: "test-tool",
      description: "desc",
      creator: "system",
      handler: { type: "test", config: {} },
      inputSchema: {},
    };
    await repo.create(tool);
    const found = await repo.findByName("test-tool");
    expect(found).toBeDefined();
    expect(found?.name).toBe("test-tool");

    await repo.updateTool("test-tool", { description: "updated" });
    const updated = await repo.findByName("test-tool");
    expect(updated?.description).toBe("updated");

    const deleted = await repo.deleteTool("test-tool");
    expect(deleted).toBe(true);
    const afterDelete = await repo.findByName("test-tool");
    expect(afterDelete).toBeNull();
  });

  it("should upsert tools and not duplicate", async () => {
    const tool: Partial<ITool> = {
      name: "upsert-tool",
      description: "desc",
      creator: "system",
      handler: { type: "test", config: {} },
      inputSchema: {},
    };
    await repo.upsertMany([tool]);
    await repo.upsertMany([{ ...tool, description: "changed" }]);
    const all = await repo.list({});
    expect(all.length).toBe(1);
    expect(all[0].description).toBe("changed");
  });

  it("should remove stale built-in tools", async () => {
    await repo.create({
      name: "keep-tool",
      description: "",
      creator: "system",
      handler: { type: "test", config: {} },
      inputSchema: {},
    });
    await repo.create({
      name: "stale-tool",
      description: "",
      creator: "system",
      handler: { type: "test", config: {} },
      inputSchema: {},
    });
    // Simulate sync: only keep-tool should remain
    const builtinToolNames = new Set(["keep-tool"]);
    const dbBuiltinTools = await repo.list({});
    for (const tool of dbBuiltinTools) {
      if (tool.creator === "system" && !builtinToolNames.has(tool.name)) {
        await repo.deleteTool(tool.name);
      }
    }
    const all = await repo.list({});
    expect(all.length).toBe(1);
    expect(all[0].name).toBe("keep-tool");
  });
});
