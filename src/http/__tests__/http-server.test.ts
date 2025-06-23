import { jest } from "@jest/globals";
import supertest from "supertest";
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

  describe("Health Endpoints", () => {
    it("GET /health returns 200 and status ok", async () => {
      const res = await supertest(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });

    it("GET /status returns 200 and status ok", async () => {
      const res = await supertest(app).get("/status");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });


  describe("SSE Transport", () => {
    it("GET /sse without API key returns 401", async () => {
      const res = await supertest(app).get("/sse");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Missing apiKey");
    });

    it("POST /messages without session returns 400", async () => {
      const res = await supertest(app)
        .post("/messages")
        .send({ jsonrpc: "2.0", method: "test", id: 1 });
      
      expect(res.status).toBe(400);
      expect(res.text).toContain("No transport found for sessionId");
    });
  });

  describe("Streamable HTTP Transport", () => {
    it("POST /mcp without API key returns 401", async () => {
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      };

      const res = await supertest(app)
        .post("/mcp")
        .send(initRequest);
      
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Missing apiKey");
    });

    it("POST /mcp without session ID and non-initialize request returns 400", async () => {
      const nonInitRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      };

      const res = await supertest(app)
        .post("/mcp?apiKey=test-api-key-123")
        .send(nonInitRequest);
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("No valid session ID provided");
    });

    it("GET /mcp without session ID returns 400", async () => {
      const res = await supertest(app).get("/mcp");
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("No valid session ID provided");
    });

    it("DELETE /mcp without session ID returns 400", async () => {
      const res = await supertest(app).delete("/mcp");
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("No valid session ID provided");
    });
  });

  describe("Route Registration", () => {
    it("allows adding custom routes", () => {
      expect(() => {
        httpServer.addHttpRoute("get", "/custom", (req, res) => {
          res.json({ custom: true });
        });
      }).not.toThrow();
    });

    it("prevents duplicate route registration", () => {
      httpServer.addHttpRoute("get", "/test-route", (req, res) => {
        res.json({ test: true });
      });

      expect(() => {
        httpServer.addHttpRoute("get", "/test-route", (req, res) => {
          res.json({ duplicate: true });
        });
      }).toThrow("Route already exists: [GET] /test-route");
    });
  });

  describe("Transport Support", () => {
    it("supports both SSE and Streamable HTTP transports", () => {
      // Verify that both transport endpoints are available
      expect(httpServer.getApp()).toBeDefined();
      
      // Test that the server has the expected methods
      expect(typeof httpServer.notifyToolListChanged).toBe("function");
      expect(typeof httpServer.getSessionManager).toBe("function");
      expect(typeof httpServer.addHttpRoute).toBe("function");
    });

    it("provides backwards compatibility with transports property", () => {
      // Test that the transports proxy works
      const transports = httpServer.transports;
      expect(transports).toBeDefined();
      expect(typeof transports).toBe("object");
    });
  });
});
