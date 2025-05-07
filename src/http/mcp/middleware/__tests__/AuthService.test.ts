import {
  jest,
  expect,
  describe,
  it,
  beforeEach,
  afterEach,
} from "@jest/globals";
import axios from "axios";
import { AuthService } from "../AuthService.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const createMockAxiosResponse = (data: any) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: {} as any,
});

describe("AuthService", () => {
  let authService: AuthService;
  let postSpy: any; // Use any type instead of jest.SpyInstance

  const mockConfig = {
    authServerUrl: "http://localhost:8080",
    realm: "test-realm",
    clientId: "test-client",
    clientSecret: "test-secret",
  };

  beforeEach(() => {
    // Create a spy for axios.post
    postSpy = jest.spyOn(axios, "post");

    // Create a new instance of AuthService for each test
    authService = new AuthService(mockConfig);
  });

  afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe("validateToken", () => {
    it("should return token data when token is valid", async () => {
      const mockTokenData = {
        active: true,
        sub: "test-user",
        email: "test@example.com",
        name: "Test User",
        preferred_username: "testuser",
        scope: "openid profile email",
        aud: ["test-client"],
        toolsAvailable: "tool1,tool2,tool3",
        toolsHidden: "tool4,tool5",
      };

      const mockResponse = {
        data: mockTokenData,
      };

      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await authService.validateToken("valid-token");

      expect(result).toEqual(mockTokenData);
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:8080/realms/test-realm/protocol/openid-connect/token/introspect",
        expect.any(URLSearchParams),
        expect.any(Object),
      );
    });

    it("should return null when token is not active", async () => {
      const mockResponse = {
        data: {
          active: false,
        },
      };

      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await authService.validateToken("invalid-token");

      expect(result).toBeNull();
    });

    it("should return null when token validation fails", async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await authService.validateToken("invalid-token");

      expect(result).toBeNull();
    });
  });

  describe("extractUserInfo", () => {
    it("should extract user info from token data", () => {
      const tokenData = {
        active: true,
        sub: "test-user",
        email: "test@example.com",
        name: "Test User",
        preferred_username: "testuser",
        scope: "openid profile email",
        aud: ["test-client"],
        toolsAvailable: "tool1,tool2,tool3",
        toolsHidden: "tool4,tool5",
      };

      const result = authService.extractUserInfo(tokenData);

      expect(result).toEqual({
        ...tokenData,
        scope: ["openid", "profile", "email"],
        toolsAvailable: ["tool1", "tool2", "tool3"],
        toolsHidden: ["tool4", "tool5"],
      });
    });

    it("should handle missing optional fields", () => {
      const tokenData = {
        active: true,
        sub: "test-user",
        email: "",
        name: "",
        preferred_username: "",
        scope: "",
        aud: [],
      };

      const result = authService.extractUserInfo(tokenData);

      expect(result).toEqual({
        ...tokenData,
        scope: [],
        aud: [],
      });
    });
  });

  describe("verifyToken", () => {
    it("should return user info when token is valid", async () => {
      const mockTokenData = {
        active: true,
        sub: "test-user",
        email: "test@example.com",
        name: "Test User",
        preferred_username: "testuser",
        scope: "openid profile email",
        aud: ["test-client"],
        toolsAvailable: "tool1,tool2,tool3",
        toolsHidden: "tool4,tool5",
      };

      const mockResponse = {
        data: mockTokenData,
      };

      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await authService.verifyToken("valid-token");

      expect(result).toEqual({
        ...mockTokenData,
        scope: ["openid", "profile", "email"],
        toolsAvailable: ["tool1", "tool2", "tool3"],
        toolsHidden: ["tool4", "tool5"],
      });
    });

    it("should return null when token is invalid", async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await authService.verifyToken("invalid-token");

      expect(result).toBeNull();
    });
  });

  describe("getToken", () => {
    it("should return access token when credentials are valid", async () => {
      const mockResponse = {
        status: 200,
        data: {
          access_token: "valid-token",
        },
      };

      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await authService.getToken("testuser", "password");

      expect(result).toBe("valid-token");
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:8080/realms/test-realm/protocol/openid-connect/token",
        expect.any(URLSearchParams),
        expect.any(Object),
      );
    });

    it("should return null when credentials are invalid", async () => {
      const mockResponse = {
        status: 401,
        data: {
          error: "invalid_grant",
          error_description: "Invalid user credentials",
        },
      };

      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await authService.getToken("testuser", "wrong-password");

      expect(result).toBeNull();
    });

    it("should return null when request fails", async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await authService.getToken("testuser", "password");

      expect(result).toBeNull();
    });
  });
});
