import { jest, expect, describe, it, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
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

// Extend Request type to include token and tokenData properties
interface RequestWithToken extends Request {
  token?: string;
  tokenData?: UserInfo;
}

// Define the type for validateToken function
type ValidateTokenFn = (token: string) => Promise<UserInfo | null>;

describe("Auth Middleware", () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockMcpServer: jest.Mocked<DynamicMcpServer>;
  let mockRequest: Partial<RequestWithToken>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock AuthService instance
    mockAuthService = {
      validateToken: jest.fn(),
      extractUserInfo: jest.fn(),
      verifyToken: jest.fn(),
      getToken: jest.fn(),
    } as jest.Mocked<AuthService>;

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
        mockRequest as RequestWithToken,
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
      const mockTokenData: UserInfo = {
        sub: "user123",
        email: "user@example.com",
        name: "Test User",
        preferred_username: "testuser",
        scope: ["openid", "profile"],
        aud: ["client-id"],
      };

      mockRequest.headers = { authorization: "Bearer valid-token" };
      mockAuthService.validateToken = jest.fn(
        async () => mockTokenData,
      ) as jest.MockedFunction<ValidateTokenFn>;

      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
      await middleware(
        mockRequest as RequestWithToken,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockAuthService.validateToken).toHaveBeenCalledWith("valid-token");
      expect(mockRequest.token).toBe("valid-token");
      expect(mockRequest.tokenData).toEqual(mockTokenData);
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should return OAuth error when token is invalid", async () => {
      mockRequest.headers = { authorization: "Bearer invalid-token" };
      mockAuthService.validateToken = jest.fn(
        async () => null,
      ) as jest.MockedFunction<ValidateTokenFn>;

      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
      await middleware(
        mockRequest as RequestWithToken,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(
        "invalid-token",
      );
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
        mockRequest as RequestWithToken,
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
      mockAuthService.validateToken = jest.fn(async () => null);

      const middleware = createAuthMiddleware(mockAuthService, mockMcpServer);
      await middleware(
        mockRequest as RequestWithToken,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockAuthService.validateToken).toHaveBeenCalledWith("valid-token");
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid token",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});

describe("createAuthMiddleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    mockAuthService = {
      validateToken: jest.fn(),
      extractUserInfo: jest.fn(),
      verifyToken: jest.fn(),
      getToken: jest.fn(),
    } as jest.Mocked<AuthService>;
  });

  it("should return 401 if no authorization header", async () => {
    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "No authorization header",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 if authorization header is not Bearer", async () => {
    mockReq.headers = {
      authorization: "Basic token123",
    };

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "No token provided" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 if token validation fails", async () => {
    mockReq.headers = {
      authorization: "Bearer token123",
    };

    mockAuthService.validateToken.mockResolvedValue(null);

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid token" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should call next() if token is valid", async () => {
    mockReq.headers = {
      authorization: "Bearer token123",
    };

    const mockTokenData = {
      active: true,
      sub: "test-user",
      email: "test@example.com",
      name: "Test User",
      preferred_username: "testuser",
      scope: "openid profile email",
      aud: ["test-client"],
    };

    mockAuthService.validateToken.mockResolvedValue(mockTokenData);

    const middleware = createAuthMiddleware(mockAuthService);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockAuthService.validateToken).toHaveBeenCalledWith("token123");
    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.token).toBe("token123");
    expect(mockReq.tokenData).toEqual(mockTokenData);
  });
});
