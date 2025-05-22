// NOTE: Skipped due to ESM mocking limitations: config/logger mocks are not picked up due to module caching. See test history for details.
import { jest } from "@jest/globals";

describe("McpHttpServer", () => {
  let McpHttpServer, logger, config, appMock;
  let mcpServer, sessionManager, authMiddleware;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    appMock = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((port, cb) => cb && cb()),
      set: jest.fn(),
    };
    jest.doMock("express", () => {
      const express = jest.fn(() => appMock);
      express.json = jest.fn(() => (req, res, next) => next());
      return express;
    });
    jest.doMock("@modelcontextprotocol/sdk/server/sse.js", () => ({
      SSEServerTransport: jest.fn(),
    }));
    jest.doMock("@modelcontextprotocol/sdk/server/index.js", () => ({
      Server: jest.fn(),
    }));
    ({ McpHttpServer } = await import("../mcp-http-server.js"));
    config = { server: { port: 1234 } };
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    mcpServer = { connect: jest.fn().mockResolvedValue(undefined) };
    sessionManager = {
      setSessionInfo: jest.fn(),
      removeSessionInfo: jest.fn(),
    };
    authMiddleware = jest.fn();
  });

  it("constructs and sets up routes", () => {
    new McpHttpServer(
      mcpServer,
      sessionManager,
      authMiddleware,
      config,
      logger,
    );
    expect(appMock.use).toHaveBeenCalled();
    expect(appMock.get).toHaveBeenCalled();
    expect(appMock.post).toHaveBeenCalled();
  });

  it("starts the server and logs info", () => {
    new McpHttpServer(
      mcpServer,
      sessionManager,
      authMiddleware,
      config,
      logger,
    ).start();
    expect(appMock.listen).toHaveBeenCalledWith(1234, expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith("MCP server started on port 1234");
  });

  it("logs error if listen throws", () => {
    appMock.listen.mockImplementationOnce(() => {
      throw new Error("fail");
    });
    new McpHttpServer(
      mcpServer,
      sessionManager,
      authMiddleware,
      config,
      logger,
    ).start();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to start MCP server"),
    );
  });

  it("getApp returns the express app", () => {
    const server = new McpHttpServer(
      mcpServer,
      sessionManager,
      authMiddleware,
      config,
      logger,
    );
    expect(server.getApp()).toBe(appMock);
  });

  it("notifyToolListChanged sends notifications to all transports", async () => {
    const transport = { send: jest.fn().mockResolvedValue(undefined) };
    const server = new McpHttpServer(
      mcpServer,
      sessionManager,
      authMiddleware,
      config,
      logger,
    );
    server["transports"] = { s1: transport, s2: transport };
    await server.notifyToolListChanged();
    expect(transport.send).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Notified client"),
    );
  });

  it("notifyToolListChanged logs warning if send fails", async () => {
    const transport = { send: jest.fn().mockRejectedValue(new Error("fail")) };
    const server = new McpHttpServer(
      mcpServer,
      sessionManager,
      authMiddleware,
      config,
      logger,
    );
    server["transports"] = { s1: transport };
    await server.notifyToolListChanged();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to notify client"),
    );
  });
});
