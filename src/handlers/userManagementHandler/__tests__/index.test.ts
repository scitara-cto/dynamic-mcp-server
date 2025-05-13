import { UserManagementHandler } from "../index.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { jest } from "@jest/globals";

describe("UserManagementHandler", () => {
  let handler: UserManagementHandler;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let context: any;

  beforeEach(() => {
    mockUserRepo = {
      list: jest.fn(),
      create: jest.fn(),
      updateUser: jest.fn(),
      findByEmail: jest.fn(),
    } as any;
    jest
      .spyOn(UserRepository.prototype, "list")
      .mockImplementation(mockUserRepo.list);
    jest
      .spyOn(UserRepository.prototype, "create")
      .mockImplementation(mockUserRepo.create);
    jest
      .spyOn(UserRepository.prototype, "updateUser")
      .mockImplementation(mockUserRepo.updateUser);
    jest
      .spyOn(UserRepository.prototype, "findByEmail")
      .mockImplementation(mockUserRepo.findByEmail);
    handler = new UserManagementHandler();
    context = {
      user: { email: "admin@example.com" },
      mcpServer: { notifyToolListChanged: jest.fn() },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should list users", async () => {
    mockUserRepo.list.mockResolvedValue([{ email: "a@example.com" }]);
    const result = await handler.handler({ nameContains: "a" }, context, {
      action: "list",
    });
    expect(result.result.users).toHaveLength(1);
  });

  it("should add a user", async () => {
    mockUserRepo.create.mockResolvedValue({ email: "b@example.com" });
    const result = await handler.handler(
      { email: "b@example.com", name: "B" },
      context,
      { action: "add" },
    );
    expect(result.result.email).toBe("b@example.com");
  });

  it("should error if adding user without email", async () => {
    await expect(
      handler.handler({ name: "NoEmail" }, context, { action: "add" }),
    ).rejects.toThrow("Email is required");
  });

  it("should update a user", async () => {
    mockUserRepo.updateUser.mockResolvedValue({
      email: "c@example.com",
      name: "C",
    });
    const result = await handler.handler(
      { email: "c@example.com", name: "C" },
      context,
      { action: "update" },
    );
    expect(result.result.email).toBe("c@example.com");
  });

  it("should error if updating user without email", async () => {
    await expect(
      handler.handler({ name: "NoEmail" }, context, { action: "update" }),
    ).rejects.toThrow("Email is required");
  });

  it("should delete a user", async () => {
    const result = await handler.handler({ email: "d@example.com" }, context, {
      action: "delete",
    });
    expect(result.result.success).toBe(true);
  });

  it("should error if deleting user without email", async () => {
    await expect(
      handler.handler({}, context, { action: "delete" }),
    ).rejects.toThrow("Email is required");
  });

  it("should share a tool", async () => {
    mockUserRepo.findByEmail.mockResolvedValue({
      email: "e@example.com",
      sharedTools: [],
    });
    mockUserRepo.updateUser.mockResolvedValue({
      email: "e@example.com",
      sharedTools: [
        {
          toolId: "t1",
          sharedBy: "admin@example.com",
          accessLevel: "read",
          sharedAt: expect.any(Date),
        },
      ],
    });
    const result = await handler.handler(
      { email: "e@example.com", toolId: "t1", accessLevel: "read" },
      context,
      { action: "share-tool" },
    );
    expect(result.result.email).toBe("e@example.com");
    expect(context.mcpServer.notifyToolListChanged).toHaveBeenCalledWith(
      "e@example.com",
    );
  });

  it("should unshare a tool", async () => {
    mockUserRepo.findByEmail.mockResolvedValue({
      email: "f@example.com",
      sharedTools: [{ toolId: "t2", sharedBy: "admin@example.com" }],
    });
    mockUserRepo.updateUser.mockResolvedValue({
      email: "f@example.com",
      sharedTools: [],
    });
    const result = await handler.handler(
      { email: "f@example.com", toolId: "t2" },
      context,
      { action: "unshare-tool" },
    );
    expect(result.result.email).toBe("f@example.com");
    expect(context.mcpServer.notifyToolListChanged).toHaveBeenCalledWith(
      "f@example.com",
    );
  });

  it("should error if sharing tool with missing fields", async () => {
    await expect(
      handler.handler({ email: "g@example.com", toolId: "t3" }, context, {
        action: "share-tool",
      }),
    ).rejects.toThrow("email, toolId, and accessLevel are required");
  });

  it("should error if unsharing tool with missing fields", async () => {
    await expect(
      handler.handler({ email: "h@example.com" }, context, {
        action: "unshare-tool",
      }),
    ).rejects.toThrow("email and toolId are required");
  });
});
