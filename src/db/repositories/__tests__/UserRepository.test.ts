import { jest } from "@jest/globals";
import { UserRepository } from "../UserRepository.js";
import { IUser } from "../../models/User.js";

describe("UserRepository (mocked)", () => {
  const now = new Date();
  const minimalUser = (email: string, name = "Test User") => ({
    email,
    name,
    createdAt: now,
    updatedAt: now,
    roles: ["user"],
    sharedTools: [],
    apiKey: "test-key",
    hiddenTools: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create, find, update, and delete a user", async () => {
    const repo = new UserRepository();
    const user = minimalUser("test@example.com");
    jest.spyOn(repo, "create").mockResolvedValue(user);
    const findByEmailMock = jest
      .spyOn(repo, "findByEmail")
      .mockResolvedValue(user);
    jest
      .spyOn(repo, "updateUser")
      .mockImplementation(async (email, updates) => {
        const updated = { ...user, ...updates };
        findByEmailMock.mockResolvedValue(updated);
        return updated;
      });
    await repo.create(user);
    const found = await repo.findByEmail("test@example.com");
    expect(found).toBeDefined();
    expect(found?.email).toBe("test@example.com");
    await repo.updateUser("test@example.com", { name: "Updated User" });
    const updated = await repo.findByEmail("test@example.com");
    expect(updated?.name).toBe("Updated User");
  });

  it("should update sharedTools", async () => {
    const repo = new UserRepository();
    const user = minimalUser("a@example.com");
    const updatedUser = {
      ...user,
      sharedTools: [
        {
          toolId: "baz",
          sharedBy: "b@example.com",
          accessLevel: "read",
          sharedAt: now,
        },
      ],
    };
    jest.spyOn(repo, "create").mockResolvedValue(user);
    jest.spyOn(repo, "updateUser").mockResolvedValue(updatedUser);
    jest.spyOn(repo, "findByEmail").mockResolvedValue(updatedUser);
    await repo.create(user);
    await repo.updateUser("a@example.com", {
      sharedTools: updatedUser.sharedTools,
    });
    const result = await repo.findByEmail("a@example.com");
    expect(result?.sharedTools[0].toolId).toBe("baz");
  });

  it("should check tool access for shared tools", async () => {
    const repo = new UserRepository();
    const user = {
      ...minimalUser("c@example.com"),
      sharedTools: [
        {
          toolId: "bar",
          sharedBy: "d@example.com",
          accessLevel: "read",
          sharedAt: now,
        },
      ],
    };
    jest.spyOn(repo, "findByEmail").mockResolvedValue(user);
    jest
      .spyOn(repo, "checkToolAccess")
      .mockImplementation(async (email, toolId) => {
        return user.sharedTools.some((t) => t.toolId === toolId);
      });
    expect(await repo.checkToolAccess("c@example.com", "bar")).toBe(true);
    expect(await repo.checkToolAccess("c@example.com", "baz")).toBe(false);
  });

  it("should bootstrap admin user if not present", async () => {
    const logger = { info: jest.fn() };
    const adminUser = { ...minimalUser("admin@example.com"), roles: ["admin"] };
    jest
      .spyOn(UserRepository, "ensureAdminUser")
      .mockImplementation(async (email, loggerArg) => {
        loggerArg.info("Admin user created: " + email);
      });
    jest
      .spyOn(UserRepository.prototype, "findByEmail")
      .mockResolvedValue(adminUser);
    await UserRepository.ensureAdminUser("admin@example.com", logger);
    const repo = new UserRepository();
    const admin = await repo.findByEmail("admin@example.com");
    expect(admin).toBeDefined();
    expect(admin?.roles).toContain("admin");
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Admin user created"),
    );
  });

  it("should not return tools that are in hiddenTools via getUserTools", async () => {
    const repo = new UserRepository();
    const user = { ...minimalUser("test@example.com"), hiddenTools: ["bar"] };
    const allTools = [{ name: "foo" }, { name: "bar" }, { name: "baz" }];
    jest.spyOn(repo, "create").mockResolvedValue(user);
    jest
      .spyOn(repo, "getUserTools")
      .mockResolvedValue([{ name: "foo" }, { name: "baz" }]);
    await repo.create(user);
    const tools = await repo.getUserTools("test@example.com");
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("foo");
    expect(toolNames).toContain("baz");
    expect(toolNames).not.toContain("bar");
  });
});
