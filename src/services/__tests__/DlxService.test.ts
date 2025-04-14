import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { DlxService } from "../DlxService.js";

// Mock environment variables
const originalEnv = process.env;

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe("DlxService", () => {
  let dlxService: DlxService;

  beforeEach(() => {
    // Setup environment variables
    process.env = { ...originalEnv, DLX_API_URL: "https://api.example.com" };
    dlxService = new DlxService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("should throw an error if DLX_API_URL is not set", () => {
      // Remove the DLX_API_URL environment variable
      delete process.env.DLX_API_URL;

      // Expect the constructor to throw an error
      expect(() => new DlxService()).toThrow("DLX_API_URL is not set");
    });

    it("should initialize with the correct base URL", () => {
      // Access the private baseUrl property using type assertion
      const baseUrl = (dlxService as any).baseUrl;
      expect(baseUrl).toBe("https://api.example.com");
    });
  });

  describe("buildUrl", () => {
    it("should build a URL without query parameters", () => {
      const url = (dlxService as any).buildUrl("/endpoint");
      expect(url).toBe("https://api.example.com/endpoint");
    });

    it("should build a URL with query parameters", () => {
      const url = (dlxService as any).buildUrl("/endpoint", { param1: "value1", param2: 123 });
      expect(url).toBe("https://api.example.com/endpoint?param1=value1&param2=123");
    });

    it("should skip null and undefined query parameters", () => {
      const url = (dlxService as any).buildUrl("/endpoint", { 
        param1: "value1", 
        param2: null, 
        param3: undefined, 
        param4: 0 
      });
      expect(url).toBe("https://api.example.com/endpoint?param1=value1&param4=0");
    });
  });

  describe("executeDlxApiCall", () => {
    it("should make a GET request without body", async () => {
      // Mock successful response with proper headers
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "test data" }),
        headers: {
          get: (name: string) => name === "content-length" ? "42" : null
        }
      } as Response);

      const result = await dlxService.executeDlxApiCall({
        method: "GET",
        path: "/test",
        params: { query: "value" },
      });

      expect(result).toEqual({ data: "test data" });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/test?query=value",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    });

    it("should make a POST request with body", async () => {
      // Mock successful response with proper headers
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 123 }),
        headers: {
          get: (name: string) => name === "content-length" ? "15" : null
        }
      } as Response);

      const result = await dlxService.executeDlxApiCall({
        method: "POST",
        path: "/create",
        data: { name: "Test Item" },
      });

      expect(result).toEqual({ id: 123 });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Test Item" }),
        }
      );
    });

    it("should handle 204 No Content responses", async () => {
      // Mock 204 No Content response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: {
          get: (name: string) => name === "content-length" ? "0" : null
        }
      } as Response);

      const result = await dlxService.executeDlxApiCall({
        method: "DELETE",
        path: "/delete/123",
      });

      expect(result).toBeNull();
    });

    it("should handle API error responses", async () => {
      // Mock error response with proper headers
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Bad Request" }),
        headers: {
          get: (name: string) => name === "content-length" ? "30" : null
        }
      } as Response);

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        })
      ).rejects.toThrow("DLX API Error (400)");
    });

    it("should handle network errors", async () => {
      // Mock network error with TypeError
      const networkError = new TypeError("Failed to fetch");
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        })
      ).rejects.toThrow("DLX API Request Error: No response received from server");
    });

    it("should handle other errors", async () => {
      // Mock other error
      mockFetch.mockRejectedValueOnce(new Error("Unknown error"));

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        })
      ).rejects.toThrow("DLX API Request Error: Unknown error");
    });
  });

  describe("test environment handling", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "test";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv.NODE_ENV;
    });

    it("should handle API error responses in test environment", async () => {
      // Create an error with status and responseData properties
      const error = new Error("API Error") as any;
      error.status = 404;
      error.responseData = { message: "Not Found" };
      
      mockFetch.mockRejectedValueOnce(error);

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        })
      ).rejects.toThrow("DLX API Error (404)");
    });

    it("should handle network errors in test environment", async () => {
      // Create a network error
      const error = new Error("Network Error") as any;
      error.isNetworkError = true;
      
      mockFetch.mockRejectedValueOnce(error);

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        })
      ).rejects.toThrow("DLX API Request Error: Network Error");
    });

    it("should handle other errors in test environment", async () => {
      // Create a generic error
      const error = new Error("Generic Error");
      
      mockFetch.mockRejectedValueOnce(error);

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        })
      ).rejects.toThrow("DLX API Request Error: Generic Error");
    });
  });
});