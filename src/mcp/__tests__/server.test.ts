import { jest } from "@jest/globals";

// Mock all dependencies BEFORE importing the server
jest.doMock("../../handlers/index.js", () => ({ handlers: [] }));
jest.mock("../../db/repositories/UserRepository.js");
jest.mock("../../db/repositories/ToolRepository.js");
jest.mock("../toolGenerator/ToolGenerator.js");
jest.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: jest.fn().mockImplementation(() => ({
    registerCapabilities: jest.fn(),
    setRequestHandler: jest.fn(),
  })),
}));
jest.doMock("../../http/auth/auth-http-server.ts", () => ({
  AuthHttpServer: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));
jest.doMock("../../http/mcp/mcp-http-server.ts", () => ({
  McpHttpServer: jest.fn().mockImplementation(() => ({
    notifyToolListChanged: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe("DynamicMcpServer (unit)", () => {
  let DynamicMcpServer, ToolGenerator, server, registerHandlerFactorySpy;

  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const baseConfig = {
    name: "test-server",
    version: "0.1.0",
    logger: mockLogger,
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    // Dynamic import after all mocks
    ({ DynamicMcpServer } = await import("../server.js"));
    ({ ToolGenerator } = await import("../toolGenerator/ToolGenerator.js"));
    registerHandlerFactorySpy = jest
      .spyOn(ToolGenerator.prototype, "registerHandlerFactory")
      .mockImplementation(() => undefined);
    server = new DynamicMcpServer(baseConfig);
    // DO NOT call server.start()
  });

  afterEach(() => {
    registerHandlerFactorySpy.mockRestore();
  });

  it("registers a handler and calls ToolGenerator.registerHandlerFactory", async () => {
    const handler = {
      name: "testHandler",
      handler: async () => Promise.resolve(),
      tools: [],
    };
    await server.registerHandler(handler);
    expect(registerHandlerFactorySpy).toHaveBeenCalledWith(
      "testHandler",
      expect.any(Function),
    );
  });

  it("setSessionInfo sets session and loads user tools if email present", async () => {
    const session = {
      sessionId: "abc",
      user: { email: "user@example.com" },
      token: "tok",
      mcpServer: server,
    };
    const loadSpy = jest
      .spyOn(server, "loadUserToolsForSession")
      .mockResolvedValue(undefined);
    await server.setSessionInfo("abc", session);
    expect(server["sessionInfo"].get("abc")).toBe(session);
    expect(loadSpy).toHaveBeenCalledWith("abc", "user@example.com");
  });

  it("setSessionInfo does not load tools if no email", async () => {
    const session = {
      sessionId: "abc",
      user: {},
      token: "tok",
      mcpServer: server,
    };
    const loadSpy = jest
      .spyOn(server, "loadUserToolsForSession")
      .mockResolvedValue(undefined);
    await server.setSessionInfo("abc", session);
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it("getSessionInfo returns session if present", () => {
    const session = {
      sessionId: "abc",
      user: { email: "user@example.com" },
      token: "tok",
      mcpServer: server,
    };
    server["sessionInfo"].set("abc", session);
    expect(server.getSessionInfo("abc")).toBe(session);
  });

  it("getSessionInfo throws if sessionId is missing", () => {
    expect(() => server.getSessionInfo(undefined)).toThrow(/No session ID/);
  });

  it("getSessionInfo throws if session not found", () => {
    expect(() => server.getSessionInfo("notfound")).toThrow(
      /No session context/,
    );
  });

  it("removeSessionInfo deletes the session", () => {
    const session = {
      sessionId: "abc",
      user: { email: "user@example.com" },
      token: "tok",
      mcpServer: server,
    };
    server["sessionInfo"].set("abc", session);
    server.removeSessionInfo("abc");
    expect(server["sessionInfo"].has("abc")).toBe(false);
  });

  it("initialize calls toolGenerator.initialize", async () => {
    const initializeSpy = jest
      .spyOn(ToolGenerator.prototype, "initialize")
      .mockImplementation(() => Promise.resolve());
    await server.initialize();
    expect(initializeSpy).toHaveBeenCalled();
    initializeSpy.mockRestore();
  });

  it("notifyToolListChanged emits toolsChanged for all or user", async () => {
    const emitSpy = jest.spyOn(server, "emit");
    // No userEmail: global
    await server.notifyToolListChanged();
    expect(emitSpy).toHaveBeenCalledWith("toolsChanged");
    // With userEmail: only matching sessions
    const session = {
      sessionId: "abc",
      user: { email: "user@example.com" },
      token: "tok",
      mcpServer: server,
    };
    server["sessionInfo"].set("abc", session);
    await server.notifyToolListChanged("user@example.com");
    expect(emitSpy).toHaveBeenCalledWith("toolsChanged", "abc");
  });
});
