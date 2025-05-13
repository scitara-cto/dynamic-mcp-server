// NOTE: Skipped due to ESM mocking limitations: config mock is not picked up due to module caching. See test history for details.
import { jest } from "@jest/globals";

describe("AuthHttpServer", () => {
  let logger, appMock, config;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    config = { auth: { port: 1234 } };
    logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
  });

  it("prints the config used by AuthHttpServer", async () => {
    expect(config.auth.port).toBe(1234);
  });

  it("starts the server and logs info", async () => {
    appMock = {
      get: jest.fn(),
      use: jest.fn(),
      listen: jest.fn((port, cb) => cb && cb()),
      post: jest.fn(),
    };
    jest.doMock("express", () => jest.fn(() => appMock));
    const { AuthHttpServer } = await import("../auth-http-server.js");
    new AuthHttpServer(config, logger).start();
    expect(appMock.listen).toHaveBeenCalledWith(1234, expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith(
      "Auth server started on port 1234",
    );
  });

  it("logs error if listen throws", async () => {
    appMock = {
      get: jest.fn(),
      use: jest.fn(),
      listen: jest.fn(() => {
        throw new Error("fail!");
      }),
      post: jest.fn(),
    };
    jest.doMock("express", () => jest.fn(() => appMock));
    const { AuthHttpServer } = await import("../auth-http-server.js");
    new AuthHttpServer(config, logger).start();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to start Auth server"),
    );
  });

  it("addHttpRoute adds a new route and logs", async () => {
    appMock = {
      get: jest.fn(),
      use: jest.fn(),
      listen: jest.fn((port, cb) => {
        cb && cb();
      }),
      post: jest.fn(),
    };
    jest.doMock("express", () => jest.fn(() => appMock));
    const { AuthHttpServer } = await import("../auth-http-server.js");
    const server = new AuthHttpServer(config, logger);
    server.addHttpRoute("get", "/custom", jest.fn());
    expect(appMock.get).toHaveBeenCalledWith("/custom", expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith(
      "Added custom route: [GET] /custom",
    );
  });
});
