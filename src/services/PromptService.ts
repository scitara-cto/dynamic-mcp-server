import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import logger from "../utils/logger.js";
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequest,
  GetPromptRequest,
  GetPromptResult,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { DynamicMcpServer } from "../mcp/server.js";
import { PromptDefinition, PromptOutput } from "../mcp/types.js";
import { UserRepository } from "../db/repositories/UserRepository.js";
import { PromptRepository } from "../db/repositories/PromptRepository.js";

export class PromptService {
  private server: Server;
  private mcpServer: DynamicMcpServer;
  private userRepository: UserRepository;
  private promptRepository: PromptRepository;
  private initialized: boolean = false;

  constructor(
    server: Server,
    mcpServer: DynamicMcpServer,
    userRepository: UserRepository,
  ) {
    this.server = server;
    this.mcpServer = mcpServer;
    this.userRepository = userRepository;
    this.promptRepository = new PromptRepository();
  }

  /**
   * Initialize the prompt service by registering handlers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register prompts/list handler
    this.server.setRequestHandler(
      ListPromptsRequestSchema,
      async (request: ListPromptsRequest, extra: RequestHandlerExtra<any, any>) => {
        try {
          const sessionInfo = this.mcpServer.getSessionInfo(extra.sessionId);
          const userEmail = sessionInfo?.user?.email;

          if (!userEmail) {
            logger.warn("No user email found in session context for prompts/list");
            return { prompts: [] };
          }

          // Get user-specific prompts from database
          const userPrompts = await this.promptRepository.getPromptsForUser(userEmail);
          
          // Convert to MCP prompt format
          const prompts = userPrompts.map((prompt: any) => ({
            name: prompt.name,
            description: prompt.description,
            arguments: prompt.arguments?.map((arg: any) => ({
              name: arg.name,
              description: arg.description,
              required: arg.required,
            })) || [],
          }));

          logger.info(`Listed ${prompts.length} prompts for user ${userEmail}`);
          return { prompts };
        } catch (error) {
          logger.error("Error listing prompts:", error);
          throw error;
        }
      },
    );

    // Register prompts/get handler
    this.server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest, extra: RequestHandlerExtra<any, any>) => {
        try {
          const sessionInfo = this.mcpServer.getSessionInfo(extra.sessionId);
          const userEmail = sessionInfo?.user?.email;

          if (!userEmail) {
            throw new Error("No user email found in session context");
          }

          const promptName = request.params?.name;
          if (!promptName) {
            throw new Error("Prompt name is required");
          }

          // Get prompt from database
          const promptDef = await this.promptRepository.getPromptForUser(userEmail, promptName);
          if (!promptDef) {
            throw new Error(`Prompt '${promptName}' not found`);
          }

          // Get the handler for this prompt
          const handler = this.mcpServer.getHandler(promptDef.handler.type);
          if (!handler) {
            throw new Error(`Handler '${promptDef.handler.type}' not found`);
          }

          // Execute the prompt handler
          const context = {
            sessionInfo,
            user: sessionInfo.user,
            promptName,
          };

          const result: PromptOutput = await handler(
            request.params?.arguments || {},
            context,
            promptDef.handler.config,
          );

          // Convert to MCP GetPromptResult format
          const promptResult: GetPromptResult = {
            description: result.description,
            messages: result.messages,
          };

          logger.info(`Executed prompt '${promptName}' for user ${userEmail}`);
          return promptResult;
        } catch (error) {
          logger.error("Error getting prompt:", error);
          throw error;
        }
      },
    );

    this.initialized = true;
    logger.info("PromptService initialized");
  }

  /**
   * Add a prompt to the database
   */
  async addPrompt(promptDef: PromptDefinition, createdBy: string): Promise<void> {
    try {
      await this.promptRepository.addPrompt(promptDef, createdBy);
      
      // Notify clients of prompt list change
      await this.mcpServer.notifyPromptListChanged();
    } catch (error) {
      logger.error(`Error adding prompt '${promptDef.name}':`, error);
      throw error;
    }
  }

  /**
   * Remove a prompt from the database
   */
  async removePrompt(promptName: string, userEmail: string): Promise<void> {
    try {
      await this.promptRepository.removePrompt(promptName, userEmail);
      logger.info(`Removed prompt '${promptName}' for user ${userEmail}`);
      
      // Notify clients of prompt list change
      await this.mcpServer.notifyPromptListChanged(userEmail);
    } catch (error) {
      logger.error(`Error removing prompt '${promptName}':`, error);
      throw error;
    }
  }

  /**
   * Update a prompt in the database
   */
  async updatePrompt(promptDef: PromptDefinition, userEmail: string): Promise<void> {
    try {
      await this.promptRepository.updatePrompt(promptDef, userEmail);
      logger.info(`Updated prompt '${promptDef.name}' for user ${userEmail}`);
      
      // Notify clients of prompt list change
      await this.mcpServer.notifyPromptListChanged(userEmail);
    } catch (error) {
      logger.error(`Error updating prompt '${promptDef.name}':`, error);
      throw error;
    }
  }

  /**
   * Get prompts for a specific user
   */
  async getPromptsForUser(userEmail: string): Promise<PromptDefinition[]> {
    try {
      return await this.promptRepository.getPromptsForUser(userEmail);
    } catch (error) {
      logger.error(`Error getting prompts for user ${userEmail}:`, error);
      throw error;
    }
  }
}