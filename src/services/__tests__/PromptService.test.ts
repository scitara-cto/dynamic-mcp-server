import { PromptService } from "../PromptService.js";
import { DynamicMcpServer } from "../../mcp/server.js";
import { UserRepository } from "../../db/repositories/UserRepository.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { PromptDefinition } from "../../mcp/types.js";

describe("PromptService", () => {
  let promptService: PromptService;
  let mockServer: any;
  let mockMcpServer: any;
  let mockUserRepository: any;
  let setRequestHandlerCalls: any[];
  let notifyPromptListChangedCalls: any[];

  beforeEach(() => {
    setRequestHandlerCalls = [];
    notifyPromptListChangedCalls = [];
    
    mockServer = {
      setRequestHandler: (schema: any, handler: any) => {
        setRequestHandlerCalls.push({ schema, handler });
      },
    };

    mockMcpServer = {
      getSessionInfo: (sessionId: string) => ({
        user: { email: "test@example.com" },
        userEmail: "test@example.com"
      }),
      notifyPromptListChanged: (userEmail?: string) => {
        notifyPromptListChangedCalls.push({ userEmail });
      },
      getHandler: (type: string) => {
        if (type === "test-handler") {
          return async (args: any, context: any, config: any) => ({
            description: "Test prompt result",
            messages: [{ role: "user", content: { type: "text", text: "Test message" } }]
          });
        }
        return null;
      },
    };

    mockUserRepository = {};

    promptService = new PromptService(mockServer, mockMcpServer, mockUserRepository);
  });

  describe("initialize", () => {
    it("should register prompt request handlers", async () => {
      await promptService.initialize();

      expect(setRequestHandlerCalls.length).toBe(2);
      expect(setRequestHandlerCalls[0].schema).toBeDefined();
      expect(setRequestHandlerCalls[0].handler).toBeInstanceOf(Function);
      expect(setRequestHandlerCalls[1].schema).toBeDefined();
      expect(setRequestHandlerCalls[1].handler).toBeInstanceOf(Function);
    });

    it("should not initialize twice", async () => {
      await promptService.initialize();
      await promptService.initialize();

      // Should still only have 2 handlers registered
      expect(setRequestHandlerCalls.length).toBe(2);
    });
  });

  describe("basic functionality", () => {
    it("should be instantiable", () => {
      expect(promptService).toBeDefined();
      expect(promptService).toBeInstanceOf(PromptService);
    });

    it("should have required methods", () => {
      expect(typeof promptService.initialize).toBe("function");
      expect(typeof promptService.addPrompt).toBe("function");
      expect(typeof promptService.updatePrompt).toBe("function");
      expect(typeof promptService.removePrompt).toBe("function");
      expect(typeof promptService.getPromptsForUser).toBe("function");
    });
  });

  describe("prompt management", () => {
    const mockPromptDef = {
      name: "test-prompt",
      description: "A test prompt",
      handler: {
        type: "test-handler",
        config: { action: "test" },
      },
    };

    beforeEach(async () => {
      // Mock the PromptRepository methods
      const mockPromptRepository = (promptService as any).promptRepository;
      mockPromptRepository.addPrompt = async () => {};
      mockPromptRepository.updatePrompt = async () => {};
      mockPromptRepository.removePrompt = async () => {};
      mockPromptRepository.getPromptsForUser = async () => [mockPromptDef];
    });

    it("should add a prompt and notify clients", async () => {
      await promptService.addPrompt(mockPromptDef, "test@example.com");

      expect(notifyPromptListChangedCalls.length).toBe(1);
      expect(notifyPromptListChangedCalls[0].userEmail).toBeUndefined();
    });

    it("should update a prompt and notify clients", async () => {
      await promptService.updatePrompt(mockPromptDef, "test@example.com");

      expect(notifyPromptListChangedCalls.length).toBe(1);
      expect(notifyPromptListChangedCalls[0].userEmail).toBe("test@example.com");
    });

    it("should remove a prompt and notify clients", async () => {
      await promptService.removePrompt("test-prompt", "test@example.com");

      expect(notifyPromptListChangedCalls.length).toBe(1);
      expect(notifyPromptListChangedCalls[0].userEmail).toBe("test@example.com");
    });

    it("should get prompts for a user", async () => {
      const prompts = await promptService.getPromptsForUser("test@example.com");

      expect(prompts).toEqual([mockPromptDef]);
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      // Mock the PromptRepository methods to throw errors
      const mockPromptRepository = (promptService as any).promptRepository;
      mockPromptRepository.addPrompt = async () => { throw new Error("DB error"); };
      mockPromptRepository.updatePrompt = async () => { throw new Error("DB error"); };
      mockPromptRepository.removePrompt = async () => { throw new Error("DB error"); };
      mockPromptRepository.getPromptsForUser = async () => { throw new Error("DB error"); };
    });

    it("should handle errors when adding prompts", async () => {
      const mockPromptDef = {
        name: "test-prompt",
        description: "A test prompt",
        handler: { type: "test-handler", config: {} },
      };

      await expect(promptService.addPrompt(mockPromptDef, "test@example.com"))
        .rejects.toThrow("DB error");
    });

    it("should handle errors when updating prompts", async () => {
      const mockPromptDef = {
        name: "test-prompt",
        description: "A test prompt",
        handler: { type: "test-handler", config: {} },
      };

      await expect(promptService.updatePrompt(mockPromptDef, "test@example.com"))
        .rejects.toThrow("DB error");
    });

    it("should handle errors when removing prompts", async () => {
      await expect(promptService.removePrompt("test-prompt", "test@example.com"))
        .rejects.toThrow("DB error");
    });

    it("should handle errors when getting prompts", async () => {
      await expect(promptService.getPromptsForUser("test@example.com"))
        .rejects.toThrow("DB error");
    });
  });
});