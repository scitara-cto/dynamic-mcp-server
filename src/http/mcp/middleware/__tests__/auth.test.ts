import { jest, expect, describe, it, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { createAuthMiddleware } from "../auth.js";
import { AuthService } from "../AuthService.js";
import { DynamicMcpServer } from "../../../../mcp/server.js";

// Mock the AuthService and DynamicMcpServer
jest.mock("../AuthService.js");
jest.mock("../../../../mcp/server.js");

// Define UserInfo type
interface UserInfo {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  scope: string[];
  aud?: string[];
  [key: string]: any;
}

// Extend Request type to include user property
interface RequestWithUser extends Request {
  user?: UserInfo;
}

// Define the type for verifyToken function
type VerifyTokenFn = (token: string) => Promise<UserInfo | null>;

describe("Auth Middleware", () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockMcpServer: jest.Mocked<DynamicMcpServer>;
  let mockRequest: Partial<RequestWithUser>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock AuthService instance
    mockAuthService = new AuthService({} as any) as jest.Mocked<AuthService>;

    // Create mock DynamicMcpServer instance
    mockMcpServer = new DynamicMcpServer(
      {} as any,
    ) as jest.Mocked<DynamicMcpServer>;

    // Create mock request object
    mockRequest = {
      headers: {},
      query: {},
    };

    // Create mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };

    // Create mock next function
    nextFunction = jest.fn();
  });

  describe("OAuth Authentication", () => {
    it("should return OAuth errors when authorization header is present but invalid", async () => {
      mockRequest.headers = { authorization: "Bearer " };

      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
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

    it("should authenticate with valid OAuth token", async () => {
      const mockUserInfo: UserInfo = {
        sub: "user123",
        email: "user@example.com",
        name: "Test User",
        preferred_username: "testuser",
        scope: ["openid", "profile"],
        aud: ["client-id"],
      };

      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockAuthService.verifyToken = jest.fn(
        async () => mockUserInfo,
      ) as jest.MockedFunction<VerifyTokenFn>;

      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
      await middleware(
        mockRequest as RequestWithUser,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
      expect(mockRequest.user).toEqual(mockUserInfo);
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should return OAuth error when token is invalid", async () => {
      mockRequest.headers = { authorization: "Bearer invalid-token" };
      mockAuthService.verifyToken = jest.fn(
        async () => null,
      ) as jest.MockedFunction<VerifyTokenFn>;

      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
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
  });

  describe("Authentication Failure", () => {
    it("should return generic error when no authentication method succeeds", async () => {
      // No API key or OAuth credentials provided
      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
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

    it("should return invalid token error when token verification fails", async () => {
      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockAuthService.verifyToken = jest.fn(async () => null);

      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
      await middleware(
        mockRequest as RequestWithUser,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid token",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
