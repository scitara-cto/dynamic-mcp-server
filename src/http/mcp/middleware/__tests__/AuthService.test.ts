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
    authServerUrl: "https://auth.example.com",
    realm: "test-realm",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
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

  describe("verifyToken", () => {
    it("should return null when token is not active", async () => {
      mockedAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({ active: false }),
      );

      const result = await authService.verifyToken("invalid-token");
      expect(result).toBeNull();
    });

    it("should return user info when token is valid", async () => {
      // Mock successful response
      mockedAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({
          active: true,
          sub: "user123",
          email: "user@example.com",
          name: "Test User",
          preferred_username: "testuser",
          scope: "openid profile email",
          aud: "test-client-id",
          toolsAvailable: ["tool1", "tool2", "tool3"],
          toolsHidden: ["tool2"],
        }),
      );

      const result = await authService.verifyToken("valid-token");

      // Verify axios was called with correct parameters
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://auth.example.com/realms/test-realm/protocol/openid-connect/token/introspect",
        expect.any(URLSearchParams),
        expect.any(Object),
      );

      // Verify the returned user info
      expect(result).toEqual({
        active: true,
        sub: "user123",
        email: "user@example.com",
        name: "Test User",
        preferred_username: "testuser",
        scope: ["openid", "profile", "email"],
        aud: ["test-client-id"],
        toolsAvailable: ["tool1", "tool2", "tool3"],
        toolsHidden: ["tool2"],
      });
    });

    it("should return null when token verification fails", async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error("Network error"));

      const result = await authService.verifyToken("valid-token");
      expect(result).toBeNull();
    });

    it("should handle missing claims in token response", async () => {
      mockedAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({
          active: true,
          sub: "user123",
        }),
      );

      const result = await authService.verifyToken("valid-token");

      // Verify axios was called
      expect(mockedAxios.post).toHaveBeenCalled();

      // Verify the result has default values for missing claims
      expect(result).toEqual({
        active: true,
        sub: "user123",
        email: "",
        name: "",
        preferred_username: "",
        scope: [],
        aud: [],
        toolsAvailable: undefined,
        toolsHidden: undefined,
      });
    });

    it("should handle string format toolsAvailable", async () => {
      mockedAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({
          active: true,
          sub: "user123",
          email: "user@example.com",
          name: "Test User",
          preferred_username: "testuser",
          scope: "openid profile email",
          aud: "test-client-id",
          toolsAvailable: "tool1,tool2, tool3",
          toolsHidden: ["tool2"],
        }),
      );

      const result = await authService.verifyToken("valid-token");

      expect(result?.toolsAvailable).toEqual(["tool1", "tool2", "tool3"]);
      expect(result?.toolsHidden).toEqual(["tool2"]);
    });

    it("should handle missing toolsAvailable", async () => {
      mockedAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({
          active: true,
          sub: "user123",
          email: "user@example.com",
          name: "Test User",
          preferred_username: "testuser",
          scope: "openid profile email",
          aud: "test-client-id",
          toolsHidden: ["tool2"],
        }),
      );

      const result = await authService.verifyToken("valid-token");

      expect(result?.toolsAvailable).toBeUndefined();
      expect(result?.toolsHidden).toEqual(["tool2"]);
    });

    it("should handle comma-separated toolsAvailable and toolsHidden", async () => {
      mockedAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({
          active: true,
          sub: "user123",
          toolsAvailable: "tool1, tool2, tool3",
          toolsHidden: "tool2, tool3",
        }),
      );

      const result = await authService.verifyToken("valid-token");

      expect(result).toEqual({
        active: true,
        sub: "user123",
        email: "",
        name: "",
        preferred_username: "",
        scope: [],
        aud: [],
        toolsAvailable: ["tool1", "tool2", "tool3"],
        toolsHidden: ["tool2", "tool3"],
      });
    });

    it("should handle missing toolsAvailable and toolsHidden", async () => {
      mockedAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({
          active: true,
          sub: "user123",
        }),
      );

      const result = await authService.verifyToken("valid-token");

      expect(result).toEqual({
        active: true,
        sub: "user123",
        email: "",
        name: "",
        preferred_username: "",
        scope: [],
        aud: [],
        toolsAvailable: undefined,
        toolsHidden: undefined,
      });
    });

    it("should handle error during token verification", async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error("Network error"));

      const result = await authService.verifyToken("valid-token");
      expect(result).toBeNull();
    });
  });

  describe("getToken", () => {
    it("should return access token when credentials are valid", async () => {
      // Mock successful response
      postSpy.mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: "valid-access-token",
        },
      });

      const result = await authService.getToken("testuser", "password123");

      // Verify axios was called with correct parameters
      expect(postSpy).toHaveBeenCalledWith(
        "https://auth.example.com/realms/test-realm/protocol/openid-connect/token",
        expect.any(URLSearchParams),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          validateStatus: expect.any(Function),
        },
      );

      // Verify the result
      expect(result).toBe("valid-access-token");
    });

    it("should return null when credentials are invalid", async () => {
      // Mock response with error status
      postSpy.mockResolvedValueOnce({
        status: 401,
        data: {
          error: "invalid_grant",
          error_description: "Invalid user credentials",
        },
      });

      const result = await authService.getToken("testuser", "wrongpassword");

      // Verify axios was called
      expect(postSpy).toHaveBeenCalled();

      // Verify the result is null
      expect(result).toBeNull();
    });

    it("should return null when network error occurs", async () => {
      // Mock axios error
      postSpy.mockRejectedValueOnce(new Error("Network error"));

      const result = await authService.getToken("testuser", "password123");

      // Verify axios was called
      expect(postSpy).toHaveBeenCalled();

      // Verify the result is null
      expect(result).toBeNull();
    });

    it("should handle non-200 status codes", async () => {
      // Mock response with non-200 status
      postSpy.mockResolvedValueOnce({
        status: 500,
        data: {
          error: "server_error",
          error_description: "Internal server error",
        },
      });

      const result = await authService.getToken("testuser", "password123");

      // Verify axios was called
      expect(postSpy).toHaveBeenCalled();

      // Verify the result is null
      expect(result).toBeNull();
    });
  });
});
