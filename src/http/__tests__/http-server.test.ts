import { jest } from "@jest/globals";
import request from "supertest";
import { HttpServer } from "../http-server.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";

describe("HttpServer", () => {
  let httpServer: HttpServer;
  let app: any;

  beforeAll(() => {
    // Minimal mocks for required constructor args
    const mcpServer = new Server({ name: "test", version: "0.0.1" });
    const sessionManager = {
      setSessionInfo: jest.fn(),
      removeSessionInfo: jest.fn(),
      notifyToolListChanged: jest.fn(),
      connect: jest.fn(),
    } as unknown as DynamicMcpServer;
    httpServer = new HttpServer(mcpServer, sessionManager, config, logger);
    app = httpServer.getApp();
  });

  it("GET /health returns 200 and status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
