import { jest, expect, describe, it, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { createAuthMiddleware } from "../auth.js";
import { AuthService } from "../../../auth/AuthService.js";

// Mock the AuthService
jest.mock("../../../auth/AuthService.js");

describe("Auth Middleware", () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock AuthService instance
    mockAuthService = new AuthService({} as any) as jest.Mocked<AuthService>;

    // Create mock request object
    mockRequest = {
      headers: {},
    };

    // Create mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Create mock next function
    nextFunction = jest.fn();
  });

  it("should return 401 when no authorization header is present", async () => {
    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "No authorization header",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 401 when authorization header has no token", async () => {
    mockRequest.headers = { authorization: "Bearer " };

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "No token provided",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    mockRequest.headers = { authorization: "Bearer invalid-token" };
    mockAuthService.verifyToken = jest.fn().mockResolvedValue(null);

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockAuthService.verifyToken).toHaveBeenCalledWith("invalid-token");
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "Invalid token",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should call next() and add user info to request when token is valid", async () => {
    const mockUserInfo = {
      sub: "user123",
      email: "user@example.com",
      name: "Test User",
      preferred_username: "testuser",
      scope: ["openid", "profile"],
      aud: ["client-id"],
    };

    mockRequest.headers = { authorization: "Bearer valid-token" };
    mockAuthService.verifyToken = jest.fn().mockResolvedValue(mockUserInfo);

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
    expect(mockRequest.user).toEqual(mockUserInfo);
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it("should return 401 when verifyToken throws an error", async () => {
    mockRequest.headers = { authorization: "Bearer valid-token" };
    mockAuthService.verifyToken = jest
      .fn()
      .mockRejectedValue(new Error("Verification failed"));

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "Authentication failed",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should handle malformed authorization header", async () => {
    mockRequest.headers = { authorization: "malformed-header" };

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "No token provided",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("should handle different authorization schemes", async () => {
    mockRequest.headers = { authorization: "Basic some-token" };

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "No token provided",
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
