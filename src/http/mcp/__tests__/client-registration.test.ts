import { jest } from "@jest/globals";

describe("handleClientRegistration", () => {
  let handleClientRegistration, config, logger;
  let req, res;
  beforeEach(async () => {
    jest.resetModules();
    jest.doMock("../../../config/index.js", () => ({
      __esModule: true,
      config: { auth: { clientId: "cid", clientSecret: "csecret" } },
      default: { auth: { clientId: "cid", clientSecret: "csecret" } },
    }));
    jest.doMock("../../../utils/logger.js", () => ({
      __esModule: true,
      default: { info: jest.fn(), error: jest.fn() },
    }));
    ({ handleClientRegistration } = await import("../client-registration.js"));
    config = (await import("../../../config/index.js")).config;
    logger = (await import("../../../utils/logger.js")).default;
    logger.info = jest.fn();
    logger.error = jest.fn();
    req = { body: { client_name: "test-client" } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });
  it("registers client and responds with info", () => {
    handleClientRegistration(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: expect.any(String),
        client_secret: expect.any(String),
        client_name: "test-client",
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Client registered successfully"),
    );
  });
  it("returns 400 if client_name missing", () => {
    req.body = {};
    handleClientRegistration(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "client_name is required" });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Client registration failed: Missing client_name",
      ),
    );
  });
  it("handles unexpected error", () => {
    req.body = null;
    handleClientRegistration(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Client registration failed:"),
    );
  });
});
