import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { DynamicMcpServer } from "../server.js";
import { handlers } from "../../handlers/index.js";

// Integration test for real handler and tool registration

describe("Integration: Handler and Tool Registration", () => {
  let server: DynamicMcpServer;

  beforeAll(async () => {
    server = new DynamicMcpServer({
      name: "integration-test-server",
      version: "0.0.1",
      port: 0, // Use ephemeral port to avoid conflicts
    });
    await server.start();
  });

  it("registers all handler factories for known handlers", () => {
    // The handler factory should be registered for each handler name
    for (const handler of handlers) {
      // This is not directly exposed, but we can check tool registration
      // by checking that tools for this handler type can be found
      for (const tool of handler.tools) {
        expect(server.toolGenerator.getRegisteredToolNames()).toContain(
          tool.name,
        );
      }
    }
  });

  it("registers expected tool names for user-management and tool-management", () => {
    const expectedTools = handlers.flatMap((h) => h.tools.map((t) => t.name));
    const registered = server.toolGenerator.getRegisteredToolNames();
    for (const toolName of expectedTools) {
      expect(registered).toContain(toolName);
    }
  });

  afterAll(async () => {
    if (server && typeof server.stop === "function") {
      await server.stop();
    }
  });
});
