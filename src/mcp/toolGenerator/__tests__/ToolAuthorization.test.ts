import { ToolAuthorization } from "../ToolAuthorization";
import { jest } from "@jest/globals";

describe("ToolAuthorization", () => {
  let mockUserRepo: any;
  let toolAuth: ToolAuthorization;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      checkToolAccess: jest.fn(),
    };
    toolAuth = new ToolAuthorization(mockUserRepo);
  });

  it("returns not authorized if no user email", async () => {
    const result = await toolAuth.authorizeToolCall(undefined, "foo");
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/No user email/);
  });

  it("returns not authorized if user not found", async () => {
    mockUserRepo.findByEmail.mockResolvedValue(undefined);
    const result = await toolAuth.authorizeToolCall("a@example.com", "foo");
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/not registered/);
  });

  it("returns not authorized if user lacks tool access", async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ email: "a@example.com" });
    mockUserRepo.checkToolAccess.mockResolvedValue(false);
    const result = await toolAuth.authorizeToolCall("a@example.com", "foo");
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/not authorized/);
  });

  it("returns authorized if user has tool access", async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ email: "a@example.com" });
    mockUserRepo.checkToolAccess.mockResolvedValue(true);
    const result = await toolAuth.authorizeToolCall("a@example.com", "foo");
    expect(result.authorized).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
