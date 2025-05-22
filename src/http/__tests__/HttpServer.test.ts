import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import { HttpServer } from "../HttpServer.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { createAuthMiddleware } from "../auth.js";
import { AuthService } from "../AuthService.js";
import { config } from "../../config/index.js";

jest.mock("../AuthService.js");
jest.mock("axios");

const mockAuthService = {
  introspectToken: jest.fn(),
};

const mockAuthMiddleware = createAuthMiddleware(
  mockAuthService as unknown as AuthService,
);

const mockServer = new Server({ name: "test", version: "1.0.0" });
const mockSessionManager = {
  setSessionInfo: jest.fn(),
  removeSessionInfo: jest.fn(),
  notifyToolListChanged: jest.fn(),
} as unknown as DynamicMcpServer;

const httpServer = new HttpServer(
  mockServer,
  mockSessionManager,
  mockAuthMiddleware,
  config,
  {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  } as any,
);
const app = httpServer.getApp();

describe("HttpServer", () => {
  describe("/health endpoint", () => {
    it("should return 200 and status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("/sessions endpoint", () => {
    it("should require auth and return activeSessions", async () => {
      // Mock auth to always pass
      mockAuthService.introspectToken.mockResolvedValue({ active: true });
      const res = await request(app)
        .get("/sessions")
        .set("Authorization", "Bearer valid");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("activeSessions");
      expect(res.body).toHaveProperty("count");
    });
  });

  describe("/register endpoint", () => {
    it("should return client registration info", async () => {
      const res = await request(app).post("/register").send({});
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("client_id");
      expect(res.body).toHaveProperty("client_secret");
      expect(res.body).toHaveProperty("redirect_uris");
    });
  });

  describe("/.well-known/oauth-authorization-server endpoint", () => {
    it("should return OAuth metadata", async () => {
      const res = await request(app).get(
        "/.well-known/oauth-authorization-server",
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("issuer");
      expect(res.body).toHaveProperty("authorization_endpoint");
      expect(res.body).toHaveProperty("token_endpoint");
    });
  });

  describe("/callback endpoint", () => {
    it("should return 400 if state is invalid", async () => {
      const res = await request(app).get("/callback?state=bad");
      expect(res.status).toBe(400);
    });
  });

  describe("Auth middleware", () => {
    it("should return 401 if no token", async () => {
      const res = await request(app).get("/sessions");
      expect(res.status).toBe(401);
    });
    it("should return 401 if token is not active", async () => {
      mockAuthService.introspectToken.mockResolvedValue({ active: false });
      const res = await request(app)
        .get("/sessions")
        .set("Authorization", "Bearer invalid");
      expect(res.status).toBe(401);
    });
  });

  describe("Custom route registration", () => {
    it("should allow downstream apps to add custom routes under /custom", async () => {
      httpServer.addHttpRoute("get", "/test", (req, res) => {
        res.json({ hello: "world" });
      });
      const res = await request(app).get("/custom/test");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hello: "world" });
    });
  });
});
