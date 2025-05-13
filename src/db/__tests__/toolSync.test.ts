import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { syncBuiltinTools, cleanupUserToolReferences } from "../toolSync.js";
import { ToolRepository } from "../repositories/ToolRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";
import logger from "../../utils/logger.js";
import { builtInTools } from "../../handlers/index.js";

// Optionally mock logger if you want to suppress output
jest.spyOn(logger, "info").mockImplementation(() => {});
jest.spyOn(logger, "debug").mockImplementation(() => {});
jest.spyOn(logger, "error").mockImplementation(() => {});

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "test" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

describe("syncBuiltinTools", () => {
  it("syncs built-in tools and removes stale ones", async () => {
    // Insert a stale tool and all built-in tools
    const toolRepo = new ToolRepository();
    const builtinNames = builtInTools.map((t) => t.name);
    await toolRepo.upsertMany([
      ...builtinNames.map((name) => ({ name, creator: "system" })),
      { name: "toolC", creator: "system" },
    ]);
    // Run sync
    const removed = await syncBuiltinTools();
    // Only toolC should be removed
    const tools = await toolRepo.list();
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(builtinNames),
    );
    expect(tools.map((t) => t.name)).not.toContain("toolC");
    expect(removed).toEqual(["toolC"]);
  });

  it("returns empty array if no stale tools", async () => {
    const toolRepo = new ToolRepository();
    const builtinNames = builtInTools.map((t) => t.name);
    await toolRepo.upsertMany(
      builtinNames.map((name) => ({ name, creator: "system" })),
    );
    const removed = await syncBuiltinTools();
    expect(removed).toEqual([]);
  });
});

describe("cleanupUserToolReferences", () => {
  it("removes stale tool references from users", async () => {
    const userRepo = new UserRepository();
    await userRepo.create({
      email: "user@example.com",
      allowedTools: ["toolA", "toolC"],
      sharedTools: [
        { toolId: "toolA", sharedBy: "admin@example.com" },
        { toolId: "toolC", sharedBy: "admin@example.com" },
      ],
    });
    await cleanupUserToolReferences(["toolC"]);
    const user = await userRepo.findByEmail("user@example.com");
    expect(user.allowedTools).toEqual(["toolA"]);
    expect(user.sharedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolId: "toolA",
          sharedBy: "admin@example.com",
        }),
      ]),
    );
  });

  it("does nothing if no removed tools", async () => {
    const userRepo = new UserRepository();
    await userRepo.create({
      email: "user@example.com",
      allowedTools: ["toolA"],
      sharedTools: [{ toolId: "toolA", sharedBy: "admin@example.com" }],
    });
    await cleanupUserToolReferences([]);
    const user = await userRepo.findByEmail("user@example.com");
    expect(user.allowedTools).toEqual(["toolA"]);
    expect(user.sharedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolId: "toolA",
          sharedBy: "admin@example.com",
        }),
      ]),
    );
  });
});
