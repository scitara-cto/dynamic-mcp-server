import {
  jest,
  expect,
  describe,
  it,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { DlxService } from "../DlxService.js";

// Mock the fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("DlxService", () => {
  let dlxService: DlxService;
  const mockBaseUrl = "https://api.example.com";

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock process.env
    process.env.DLX_API_URL = mockBaseUrl;

    // Create a new instance of DlxService
    dlxService = new DlxService();

    // Mock successful response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-length": "100",
      }),
      json: jest.fn().mockResolvedValue({ data: "test" }),
    });
  });

  afterEach(() => {
    // Restore process.env
    delete process.env.DLX_API_URL;
  });

  describe("executeDlxApiCall", () => {
    it("should make a request with the correct URL and method", async () => {
      await dlxService.executeDlxApiCall({
        method: "GET",
        path: "/test",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/test`,
        expect.objectContaining({
          method: "GET",
        }),
      );
    });

    it("should include query parameters in the URL", async () => {
      await dlxService.executeDlxApiCall({
        method: "GET",
        path: "/test",
        params: {
          param1: "value1",
          param2: 123,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/test?param1=value1&param2=123`,
        expect.any(Object),
      );
    });

    it("should include the request body for POST requests", async () => {
      const requestData = { key: "value" };

      await dlxService.executeDlxApiCall({
        method: "POST",
        path: "/test",
        data: requestData,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/test`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestData),
        }),
      );
    });

    it("should include the Authorization header with Bearer token when provided", async () => {
      const token = "test-token-123";

      await dlxService.executeDlxApiCall({
        method: "GET",
        path: "/test",
        token,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/test`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        }),
      );
    });

    it("should handle empty responses correctly", async () => {
      // Mock a 204 No Content response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({
          "content-length": "0",
        }),
      });

      const result = await dlxService.executeDlxApiCall({
        method: "GET",
        path: "/test",
      });

      expect(result).toBeNull();
    });

    it("should handle API errors correctly", async () => {
      const errorResponse = { error: "Not Found" };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({
          "content-length": "100",
        }),
        json: jest.fn().mockResolvedValue(errorResponse),
      });

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        }),
      ).rejects.toThrow("DLX API Error (404)");
    });

    it("should handle network errors correctly", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(
        dlxService.executeDlxApiCall({
          method: "GET",
          path: "/test",
        }),
      ).rejects.toThrow(
        "DLX API Request Error: No response received from server",
      );
    });
  });
});
