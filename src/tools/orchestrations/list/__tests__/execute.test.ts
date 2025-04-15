import {
  jest,
  expect,
  describe,
  it,
  beforeEach,
  afterEach,
} from "@jest/globals";
import execute from "../execute.js";
import { DlxService } from "../../../../services/DlxService.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

describe("List Orchestrations Tool", () => {
  let mockExecuteDlxApiCall: jest.SpyInstance;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock process.env
    process.env = {
      ...originalEnv,
      DLX_API_URL: "https://test-api.example.com",
    };

    // Create a spy on the DlxService.prototype.executeDlxApiCall method
    mockExecuteDlxApiCall = jest
      .spyOn(DlxService.prototype, "executeDlxApiCall")
      .mockResolvedValue({ data: "test" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Restore process.env
    process.env = originalEnv;
  });

  describe("execute", () => {
    it("should call DlxService with the correct parameters", async () => {
      const input = {
        nameContains: "test",
        limit: 10,
        offset: 0,
      };

      await execute(input);

      expect(mockExecuteDlxApiCall).toHaveBeenCalledWith({
        method: "GET",
        path: "/orchestrations",
        params: {
          nameContains: "test",
          limit: 10,
          offset: 0,
        },
      });
    });

    it("should extract and pass the token from the context", async () => {
      const input = {};
      const context = {
        authInfo: {
          token: "test-token-123",
          clientId: "test-client",
        } as AuthInfo,
      };

      await execute(input, context);

      expect(mockExecuteDlxApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "test-token-123",
        }),
      );
    });

    it("should handle missing context gracefully", async () => {
      const input = {};

      await execute(input);

      expect(mockExecuteDlxApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          token: undefined,
        }),
      );
    });

    it("should handle missing authInfo gracefully", async () => {
      const input = {};
      const context = {};

      await execute(input, context);

      expect(mockExecuteDlxApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          token: undefined,
        }),
      );
    });

    it("should handle missing token in authInfo gracefully", async () => {
      const input = {};
      const context = {
        authInfo: {
          clientId: "test-client",
        } as AuthInfo,
      };

      await execute(input, context);

      expect(mockExecuteDlxApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          token: undefined,
        }),
      );
    });

    it("should return the response in the correct format", async () => {
      const input = {};
      const testData = { data: "test" };
      mockExecuteDlxApiCall.mockResolvedValueOnce(testData);

      const result = await execute(input);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: JSON.stringify(testData, null, 2),
          },
        ],
      });
    });

    it("should handle errors correctly", async () => {
      const input = {};
      const testError = new Error("Test error");
      mockExecuteDlxApiCall.mockRejectedValueOnce(testError);

      const result = await execute(input);

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: `Error listing orchestrations: ${testError.message}`,
          },
        ],
        isError: true,
      });
    });
  });
});
