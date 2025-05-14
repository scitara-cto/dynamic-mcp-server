// Mock logger before any imports
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

// @ts-nocheck
import { jest } from "@jest/globals";

// Remove static imports of server, ToolGenerator, UserRepository, ToolRepository, Server
// All will be dynamically imported in beforeEach

jest.mock("../../db/repositories/UserRepository.js");
jest.mock("../../db/repositories/ToolRepository.js");
jest.mock("../toolGenerator/ToolGenerator.js");
jest.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: jest.fn().mockImplementation(() => ({
    registerCapabilities: jest.fn(),
    setRequestHandler: jest.fn(),
  })),
}));

let DynamicMcpServer;
let ToolGenerator;
let UserRepository;
let ToolRepository;
let Server;

const baseConfig = {
  name: "test-server",
  version: "0.1.0",
  logger: mockLogger,
};

describe("DynamicMcpServer", () => {
  let server;
  let findByEmailSpy;
  let registerHandlerFactorySpy;
  let initializeSpy;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock("../../utils/logger.js", () => mockLogger);
    // Dynamic imports after mocks
    ({ DynamicMcpServer } = await import("../server.js"));
    ({ ToolGenerator } = await import("../toolGenerator/ToolGenerator.js"));
    ({ UserRepository } = await import(
      "../../db/repositories/UserRepository.js"
    ));
    ({ ToolRepository } = await import(
      "../../db/repositories/ToolRepository.js"
    ));
    ({ Server } = await import("@modelcontextprotocol/sdk/server/index.js"));
    findByEmailSpy = jest
      .spyOn(UserRepository.prototype, "findByEmail")
      .mockImplementation(() => Promise.resolve(null));
    registerHandlerFactorySpy = jest
      .spyOn(ToolGenerator.prototype, "registerHandlerFactory")
      .mockImplementation(() => undefined);
    initializeSpy = jest
      .spyOn(ToolGenerator.prototype, "initialize")
      .mockImplementation(() => Promise.resolve());
    mockLogger.error.mockClear();
    server = new DynamicMcpServer(baseConfig);
    await server.initializeHandlers();
  });

  afterEach(() => {
    findByEmailSpy.mockRestore();
    registerHandlerFactorySpy.mockRestore();
    initializeSpy.mockRestore();
  });

  it("constructs with config and initializes dependencies", () => {
    expect(server).toBeInstanceOf(DynamicMcpServer);
    expect(typeof server.registerHandler).toBe("function");
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
    initializeSpy.mockResolvedValue(undefined);
    await server.initialize();
    expect(initializeSpy).toHaveBeenCalled();
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
