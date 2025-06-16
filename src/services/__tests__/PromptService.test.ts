import { PromptService } from "../PromptService.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { PromptDefinition } from "../../mcp/types.js";

// Mock dependencies
jest.mock("../../db/repositories/PromptRepository.js");
jest.mock("../../utils/logger.js");

describe("PromptService", () => {
  let promptService: PromptService;
  let mockServer: jest.Mocked<Server>;
  let mockMcpServer: jest.Mocked<DynamicMcpServer>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockServer = {
      setRequestHandler: jest.fn(),
    } as any;

    mockMcpServer = {
      getSessionInfo: jest.fn(),
      notifyPromptListChanged: jest.fn(),
    } as any;

    mockUserRepository = {} as any;

    promptService = new PromptService(mockServer, mockMcpServer, mockUserRepository);
  });

  describe("initialize", () => {
    it("should register prompt request handlers", async () => {
      await promptService.initialize();

      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.objectContaining({ _def: expect.objectContaining({ typeName: "ZodObject" }) }),
        expect.any(Function)
      );
    });
  });

  describe("addPrompt", () => {
    it("should add a prompt and notify clients", async () => {
      const promptDef: PromptDefinition = {
        name: "test-prompt",
        description: "A test prompt",
        handler: {
          type: "test-handler",
          config: { action: "test" },
        },
      };

      // Mock the repository method
      const mockPromptRepository = require("../../db/repositories/PromptRepository.js").PromptRepository;
      mockPromptRepository.prototype.addPrompt = jest.fn().mockResolvedValue(undefined);

      await promptService.addPrompt(promptDef, "test@example.com");

      expect(mockPromptRepository.prototype.addPrompt).toHaveBeenCalledWith(
        promptDef,
        "test@example.com"
      );
      expect(mockMcpServer.notifyPromptListChanged).toHaveBeenCalled();
    });
  });

  describe("getPromptsForUser", () => {
    it("should return prompts for a user", async () => {
      const mockPrompts: PromptDefinition[] = [
        {
          name: "test-prompt",
          description: "A test prompt",
          handler: {
            type: "test-handler",
            config: { action: "test" },
          },
        },
      ];

      // Mock the repository method
      const mockPromptRepository = require("../../db/repositories/PromptRepository.js").PromptRepository;
      mockPromptRepository.prototype.getPromptsForUser = jest.fn().mockResolvedValue(mockPrompts);

      const result = await promptService.getPromptsForUser("test@example.com");

      expect(result).toEqual(mockPrompts);
      expect(mockPromptRepository.prototype.getPromptsForUser).toHaveBeenCalledWith("test@example.com");
    });
  });
});