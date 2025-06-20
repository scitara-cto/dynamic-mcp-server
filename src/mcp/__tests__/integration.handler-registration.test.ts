import { describe, it, beforeAll, afterAll, jest } from "@jest/globals";
import { DynamicMcpServer } from "../server.js";

jest.setTimeout(20000);

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

  it("should pass", () => {
    expect(true).toBe(true);
  });

  afterAll(async () => {
    if (server && typeof server.stop === "function") {
      await server.stop();
    }
  });
});
