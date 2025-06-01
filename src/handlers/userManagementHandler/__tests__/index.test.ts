import { userManagementHandlerPackage } from "../index.js";
import { UserRepository } from "../../../db/repositories/UserRepository.js";
import { jest } from "@jest/globals";
import type { IUser } from "../../../db/models/User.js";

describe("userManagementHandlerPackage.handler", () => {
  const handler = userManagementHandlerPackage.handler;
  let context: any;
  let baseUser: IUser;

  beforeEach(() => {
    baseUser = {
      email: "admin@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedTools: [],
      apiKey: "test-key",
      hiddenTools: [],
    };
    context = {
      user: { ...baseUser },
      mcpServer: { notifyToolListChanged: jest.fn() },
    };
    jest.restoreAllMocks();
  });

  it("should list users", async () => {
    jest.spyOn(UserRepository.prototype, "list").mockResolvedValue([
      {
        email: "a@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        sharedTools: [],
        apiKey: "test-key",
        hiddenTools: [],
      },
    ]);
    const result = await handler({ nameContains: "a" }, context, {
      action: "list",
    });
    expect(result.result.users).toHaveLength(1);
  });

  it("should add a user", async () => {
    jest.spyOn(UserRepository.prototype, "create").mockResolvedValue({
      email: "b@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedTools: [],
      apiKey: "test-key",
      hiddenTools: [],
    });
    const result = await handler(
      { email: "b@example.com", name: "B" },
      context,
      { action: "add" },
    );
    expect(result.result.email).toBe("b@example.com");
  });

  it("should error if adding user without email", async () => {
    await expect(
      handler({ name: "NoEmail" }, context, { action: "add" }),
    ).rejects.toThrow("Email is required");
  });

  it("should update a user", async () => {
    jest.spyOn(UserRepository.prototype, "updateUser").mockResolvedValue({
      email: "c@example.com",
      name: "C",
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedTools: [],
      apiKey: "test-key",
      hiddenTools: [],
    });
    context.user.roles = ["admin"];
    const result = await handler(
      { email: "c@example.com", name: "C" },
      context,
      { action: "update" },
    );
    expect(result.result.email).toBe("c@example.com");
  });

  it("should error if updating user without email", async () => {
    await expect(
      handler({ name: "NoEmail" }, context, { action: "update" }),
    ).rejects.toThrow("Email is required");
  });

  it("should delete a user", async () => {
    jest.spyOn(UserRepository.prototype, "removeUser").mockResolvedValue(true);
    const result = await handler({ email: "d@example.com" }, context, {
      action: "delete",
    });
    expect(result.result.success).toBe(true);
  });

  it("should error if deleting user without email", async () => {
    await expect(handler({}, context, { action: "delete" })).rejects.toThrow(
      "Email is required",
    );
  });

  it("should share a tool", async () => {
    jest.spyOn(UserRepository.prototype, "findByEmail").mockResolvedValue({
      email: "e@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedTools: [],
      apiKey: "test-key",
      hiddenTools: [],
    });
    jest.spyOn(UserRepository.prototype, "updateUser").mockResolvedValue({
      email: "e@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedTools: [
        {
          toolId: "t1",
          sharedBy: "admin@example.com",
          accessLevel: "read",
          sharedAt: new Date(),
        },
      ],
      apiKey: "test-key",
      hiddenTools: [],
    });
    const result = await handler(
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
    jest.spyOn(UserRepository.prototype, "findByEmail").mockResolvedValue({
      email: "f@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedTools: [
        {
          toolId: "t2",
          sharedBy: "admin@example.com",
          accessLevel: "read",
          sharedAt: new Date(),
        },
      ],
      apiKey: "test-key",
      hiddenTools: [],
    });
    jest.spyOn(UserRepository.prototype, "updateUser").mockResolvedValue({
      email: "f@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedTools: [],
      apiKey: "test-key",
      hiddenTools: [],
    });
    const result = await handler(
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
      handler({ email: "g@example.com", toolId: "t3" }, context, {
        action: "share-tool",
      }),
    ).rejects.toThrow("email, toolId, and accessLevel are required");
  });

  it("should error if unsharing tool with missing fields", async () => {
    await expect(
      handler({ email: "h@example.com" }, context, {
        action: "unshare-tool",
      }),
    ).rejects.toThrow("email and toolId are required");
  });

  it("should hide multiple tools", async () => {
    const spy = jest
      .spyOn(UserRepository.prototype, "addHiddenTools")
      .mockResolvedValue({
        email: "admin@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        sharedTools: [],
        apiKey: "test-key",
        hiddenTools: ["t1", "t2"],
      });
    const result = await handler({ toolId: ["t1", "t2"] }, context, {
      action: "hide-tool",
    });
    expect(result.result.success).toBe(true);
    expect(result.result.hiddenTools).toEqual(["t1", "t2"]);
    expect(result.message).toMatch(/t1, t2/);
    expect(spy).toHaveBeenCalledWith("admin@example.com", ["t1", "t2"]);
  });

  it("should error if hide-tool called with non-array toolId", async () => {
    await expect(
      handler({ toolId: "t1" }, context, { action: "hide-tool" }),
    ).rejects.toThrow(/toolId must be an array of strings/);
    await expect(
      handler({ toolId: 123 }, context, { action: "hide-tool" }),
    ).rejects.toThrow(/toolId must be an array of strings/);
  });

  it("should unhide multiple tools", async () => {
    const spy = jest
      .spyOn(UserRepository.prototype, "removeHiddenTools")
      .mockResolvedValue({
        email: "admin@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        sharedTools: [],
        apiKey: "test-key",
        hiddenTools: ["t2"],
      });
    const result = await handler({ toolId: ["t1", "t2"] }, context, {
      action: "unhide-tool",
    });
    expect(result.result.success).toBe(true);
    expect(result.result.hiddenTools).toEqual(["t2"]);
    expect(result.message).toMatch(/t1, t2/);
    expect(spy).toHaveBeenCalledWith("admin@example.com", ["t1", "t2"]);
  });

  it("should error if unhide-tool called with non-array toolId", async () => {
    await expect(
      handler({ toolId: "t1" }, context, { action: "unhide-tool" }),
    ).rejects.toThrow(/toolId must be an array of strings/);
    await expect(
      handler({ toolId: 123 }, context, { action: "unhide-tool" }),
    ).rejects.toThrow(/toolId must be an array of strings/);
  });
});
