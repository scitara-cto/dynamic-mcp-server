import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { DynamicMcpServer } from "../server.js";
import { handlers } from "../../handlers/index.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { User } from "../../db/models/User.js";

// Integration test for real handler and tool registration

describe("Integration: Handler and Tool Registration", () => {
  let server: DynamicMcpServer;

  beforeAll(async () => {
    server = new DynamicMcpServer({
      name: "integration-test-server",
      version: "0.0.1",
    });
    await server.start();
  });

  it("publishes alwaysUsed tools for a user session", async () => {
    // 1. Create a test user with all roles
    const testUserEmail = "integration-test-user@example.com";
    const userRepo = new UserRepository();
    // Ensure no duplicate user
    await User.deleteOne({ email: testUserEmail });
    await userRepo.create({
      email: testUserEmail,
      name: "Integration Test User",
      roles: ["user", "power-user", "admin"],
      sharedTools: [],
      usedTools: [],
    });

    // 2. Simulate a session for this user
    const sessionId = "integration-session";
    await server.setSessionInfo(sessionId, {
      sessionId,
      user: {
        email: testUserEmail,
        roles: ["user", "power-user", "admin"],
        sharedTools: [],
        usedTools: [],
        active: true,
        sub: "integration-test-sub",
        name: "Integration Test User",
        preferred_username: "integration-test-user",
        scope: ["user", "power-user", "admin"],
        aud: ["integration-test-aud"],
      },
      token: "fake-token",
      mcpServer: server,
    });

    // 3. Now check that alwaysUsed tools are published
    const alwaysUsedToolNames = handlers
      .flatMap((handler) => handler.tools)
      .filter((tool) => tool.alwaysUsed)
      .map((tool) => tool.name);
    const registered = server.toolGenerator.getRegisteredToolNames();
    for (const toolName of alwaysUsedToolNames) {
      expect(registered).toContain(toolName);
    }
  });

  afterAll(async () => {
    if (server && typeof server.stop === "function") {
      await server.stop();
    }
  });
});
