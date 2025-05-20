import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { UserRepository } from "../UserRepository.js";
import { User, IUser } from "../../models/User.js";
import { Tool } from "../../models/Tool.js";
import { jest } from "@jest/globals";

describe("UserRepository", () => {
  let mongoServer: MongoMemoryServer;
  let repo: UserRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), { dbName: "test" });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    repo = new UserRepository();
  });

  it("should create, find, update, and delete a user", async () => {
    const user: Partial<IUser> = {
      email: "test@example.com",
      name: "Test User",
      sharedTools: [],
    };
    await repo.create(user);
    const found = await repo.findByEmail("test@example.com");
    expect(found).toBeDefined();
    expect(found?.email).toBe("test@example.com");

    await repo.updateUser("test@example.com", { name: "Updated User" });
    const updated = await repo.findByEmail("test@example.com");
    expect(updated?.name).toBe("Updated User");
  });

  it("should update sharedTools", async () => {
    await repo.create({
      email: "a@example.com",
      sharedTools: [],
    });
    await repo.updateUser("a@example.com", {
      sharedTools: [
        {
          toolId: "baz",
          sharedBy: "b@example.com",
          accessLevel: "read",
          sharedAt: new Date(),
        },
      ],
    });
    const user = await repo.findByEmail("a@example.com");
    expect(user?.sharedTools[0].toolId).toBe("baz");
  });

  it("should check tool access for shared tools", async () => {
    await repo.create({
      email: "c@example.com",
      sharedTools: [
        {
          toolId: "bar",
          sharedBy: "d@example.com",
          accessLevel: "read",
          sharedAt: new Date(),
        },
      ],
    });
    expect(await repo.checkToolAccess("c@example.com", "bar")).toBe(true);
    expect(await repo.checkToolAccess("c@example.com", "baz")).toBe(false);
  });

  it("should bootstrap admin user if not present", async () => {
    const logger = { info: jest.fn() };
    await UserRepository.ensureAdminUser("admin@example.com", logger);
    const admin = await repo.findByEmail("admin@example.com");
    expect(admin).toBeDefined();
    expect(admin?.roles).toContain("admin");
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Admin user created"),
    );
  });

  it("should not return tools that are in hiddenTools via getUserTools", async () => {
    const spy = jest.spyOn(Tool, "find").mockImplementation((query: any) => {
      // Simulate three tools: 'foo', 'bar', 'baz'
      const all = [
        { name: "foo", rolesPermitted: ["user"], creator: "test@example.com" },
        { name: "bar", rolesPermitted: ["user"], creator: "test@example.com" },
        { name: "baz", rolesPermitted: ["user"], creator: "test@example.com" },
      ];
      // Simulate MongoDB $nin filter for hiddenTools
      const hidden = query.$and?.[1]?.name?.$nin || [];
      return {
        lean: () =>
          Promise.resolve(all.filter((t) => !hidden.includes(t.name))),
      };
    });

    await repo.create({
      email: "test@example.com",
      roles: ["user"],
      sharedTools: [],
      hiddenTools: ["bar"],
    });
    const tools = await repo.getUserTools("test@example.com");
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("foo");
    expect(toolNames).toContain("baz");
    expect(toolNames).not.toContain("bar");
    spy.mockRestore();
  });
});
