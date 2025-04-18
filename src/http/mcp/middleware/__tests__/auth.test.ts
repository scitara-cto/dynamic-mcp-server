import { jest, expect, describe, it, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { createAuthMiddleware } from "../auth.js";
import { AuthService } from "../../../auth/AuthService.js";

// Mock the AuthService
jest.mock("../../../auth/AuthService.js");

// Define UserInfo type
interface UserInfo {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  scope: string[];
  aud: string[];
}

// Extend Request type to include user property
interface RequestWithUser extends Request {
  user?: UserInfo;
}

// Define the type for verifyToken function
type VerifyTokenFn = (token: string) => Promise<UserInfo | null>;

describe("Auth Middleware", () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: Partial<RequestWithUser>;
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
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };

    // Create mock next function
    nextFunction = jest.fn();
  });

  it("should return 401 when no authorization header is present", async () => {
    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as RequestWithUser,
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
      mockRequest as RequestWithUser,
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
    // Create a properly typed mock function
    mockAuthService.verifyToken = jest.fn(
      async () => null,
    ) as jest.MockedFunction<VerifyTokenFn>;

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as RequestWithUser,
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
    const mockUserInfo: UserInfo = {
      sub: "user123",
      email: "user@example.com",
      name: "Test User",
      preferred_username: "testuser",
      scope: ["openid", "profile"],
      aud: ["client-id"],
    };

    mockRequest.headers = { authorization: "Bearer valid-token" };
    // Create a properly typed mock function
    mockAuthService.verifyToken = jest.fn(
      async () => mockUserInfo,
    ) as jest.MockedFunction<VerifyTokenFn>;

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as RequestWithUser,
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
    // Create a properly typed mock function
    mockAuthService.verifyToken = jest.fn(async () => {
      throw new Error("Verification failed");
    }) as jest.MockedFunction<VerifyTokenFn>;

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(
      mockRequest as RequestWithUser,
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
      mockRequest as RequestWithUser,
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
      mockRequest as RequestWithUser,
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
