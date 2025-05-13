import { jest } from "@jest/globals";

describe("handleProtectedResourceMetadata", () => {
  let handleProtectedResourceMetadata, config, logger;
  let req, res;
  beforeEach(async () => {
    jest.resetModules();
    jest.doMock("../../../config/index.js", () => ({
      __esModule: true,
      config: {
        auth: { authServerUrl: "http://auth", realm: "realm" },
        server: { name: "srv", version: "1.0.0" },
      },
      default: {
        auth: { authServerUrl: "http://auth", realm: "realm" },
        server: { name: "srv", version: "1.0.0" },
      },
    }));
    jest.doMock("../../../utils/logger.js", () => ({
      __esModule: true,
      default: { debug: jest.fn() },
    }));
    ({ handleProtectedResourceMetadata } = await import("../discovery.js"));
    config = (await import("../../../config/index.js")).config;
    logger = (await import("../../../utils/logger.js")).default;
    logger.debug = jest.fn();
    req = {};
    res = { json: jest.fn() };
  });
  it("responds with protected resource metadata and logs", () => {
    handleProtectedResourceMetadata(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ issuer: expect.any(String), version: "1.0.0" }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Protected Resource Metadata requested",
    );
  });
});

describe("handleAuthorizationServerMetadata", () => {
  let handleAuthorizationServerMetadata, config, logger;
  let req, res;
  beforeEach(async () => {
    jest.resetModules();
    jest.doMock("../../../config/index.js", () => ({
      __esModule: true,
      config: {
        auth: {
          authServerUrl: "http://auth",
          realm: "realm",
          authorizationUrl: "http://auth/authorize",
          tokenUrl: "http://auth/token",
          scopes: ["openid", "profile"],
        },
        server: { name: "srv", version: "1.0.0" },
      },
      default: {
        auth: {
          authServerUrl: "http://auth",
          realm: "realm",
          authorizationUrl: "http://auth/authorize",
          tokenUrl: "http://auth/token",
          scopes: ["openid", "profile"],
        },
        server: { name: "srv", version: "1.0.0" },
      },
    }));
    jest.doMock("../../../utils/logger.js", () => ({
      __esModule: true,
      default: { debug: jest.fn() },
    }));
    ({ handleAuthorizationServerMetadata } = await import("../discovery.js"));
    config = (await import("../../../config/index.js")).config;
    logger = (await import("../../../utils/logger.js")).default;
    logger.debug = jest.fn();
    req = {};
    res = { json: jest.fn() };
  });
  it("responds with authorization server metadata and logs", () => {
    handleAuthorizationServerMetadata(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: expect.any(String),
        authorization_endpoint: expect.any(String),
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Authorization Server Metadata requested",
    );
  });
});
