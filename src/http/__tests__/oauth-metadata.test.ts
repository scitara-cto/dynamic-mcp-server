import { jest } from "@jest/globals";

describe("handleOAuthMetadata", () => {
  let handleOAuthMetadata, config, logger;
  let req, res;
  beforeEach(async () => {
    jest.resetModules();
    jest.doMock("../../../config/index.js", () => ({
      __esModule: true,
      config: {
        server: { name: "srv" },
        auth: {
          authorizationUrl: "http://auth/authorize",
          tokenUrl: "http://auth/token",
          authServerUrl: "http://auth",
          realm: "realm",
          scopes: ["openid", "profile"],
        },
      },
      default: {
        server: { name: "srv" },
        auth: {
          authorizationUrl: "http://auth/authorize",
          tokenUrl: "http://auth/token",
          authServerUrl: "http://auth",
          realm: "realm",
          scopes: ["openid", "profile"],
        },
      },
    }));
    jest.doMock("../../../utils/logger.js", () => ({
      __esModule: true,
      default: { debug: jest.fn() },
    }));
    ({ handleOAuthMetadata } = await import("../oauth-metadata.js"));
    config = (await import("../../../config/index.js")).config;
    logger = (await import("../../../utils/logger.js")).default;
    logger.debug = jest.fn();
    req = { protocol: "https", get: jest.fn(() => "host.com") };
    res = { json: jest.fn() };
  });
  it("responds with OAuth metadata and logs", () => {
    handleOAuthMetadata(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: expect.any(String),
        authorization_endpoint: expect.any(String),
        token_endpoint: expect.any(String),
        registration_endpoint: expect.any(String),
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith("OAuth metadata requested");
  });
});
