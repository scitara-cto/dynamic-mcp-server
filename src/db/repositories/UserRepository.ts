import { User, IUser } from "../models/User.js";
import { Tool } from "../models/Tool.js";
import { randomUUID } from "crypto";
import { sendEmail } from "../../services/EmailService.js";
import { config } from "../../config/index.js";

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    const doc = await User.findOne({ email });
    return doc ? doc.toJSON() : null;
  }

  async create(user: Partial<IUser>): Promise<IUser> {
    if (!user.email) {
      throw new Error("User email is required");
    }
    // Auto-generate apiKey if not provided
    if (!user.apiKey) {
      user.apiKey = randomUUID();
    }
    const newUser = new User(user);
    const saved = await newUser.save();
    return saved.toJSON();
  }

  async updateUser(
    email: string,
    updates: Partial<IUser>,
  ): Promise<IUser | null> {
    const doc = await User.findOneAndUpdate(
      { email },
      { $set: updates },
      { new: true },
    );
    return doc ? doc.toJSON() : null;
  }

  async list(
    params: { nameContains?: string; skip?: number; limit?: number } = {},
  ): Promise<IUser[]> {
    const { nameContains, skip = 0, limit = 20 } = params;
    const filter: any = {};
    if (nameContains) {
      filter.name = { $regex: nameContains, $options: "i" };
    }
    const docs = await User.find(filter).skip(skip).limit(limit);
    return docs.map((doc) => doc.toJSON());
  }

  async checkToolAccess(email: string, toolId: string): Promise<boolean> {
    const user = await User.findOne({ email });
    if (!user) return false;
    // Check sharedTools
    if (user.sharedTools.some((t) => t.toolId === toolId)) return true;
    // Get tool definition (assume ToolRepository exists and has findByName)
    const { ToolRepository } = await import(
      "../repositories/ToolRepository.js"
    );
    const toolRepo = new ToolRepository();
    const toolDef = await toolRepo.findByName(toolId);
    if (!toolDef) return false;
    // Check if user is the creator
    if (toolDef.creator === user.email) return true;
    if (!Array.isArray(toolDef.rolesPermitted)) return false;
    // Check if user has any permitted role
    const userRoles = user.roles || [];
    return userRoles.some((role) => toolDef.rolesPermitted!.includes(role));
  }

  async addHiddenTools(
    email: string,
    toolIds: string[],
  ): Promise<IUser | null> {
    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      throw new Error("toolIds must be a non-empty array");
    }
    
    // toolIds come in as simple names, need to resolve to namespacedName
    const userTools = await this.getUserToolsInternal(email);
    
    const namespacedToolIds = toolIds.map(simpleName => {
      const tool = userTools.find(t => t.name === simpleName);
      return tool ? `${tool.creator}:${tool.name}` : simpleName;
    });
    
    const doc = await User.findOneAndUpdate(
      { email },
      { $addToSet: { hiddenTools: { $each: namespacedToolIds } } },
      { new: true },
    );
    return doc ? doc.toJSON() : null;
  }

  async removeHiddenTools(
    email: string,
    toolIds: string[],
  ): Promise<IUser | null> {
    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      throw new Error("toolIds must be a non-empty array");
    }
    
    // toolIds come in as simple names, need to resolve to namespacedName
    const userTools = await this.getUserToolsInternal(email);
    
    const namespacedToolIds = toolIds.map(simpleName => {
      const tool = userTools.find(t => t.name === simpleName);
      return tool ? `${tool.creator}:${tool.name}` : simpleName;
    });
    
    const doc = await User.findOneAndUpdate(
      { email },
      { $pull: { hiddenTools: { $in: namespacedToolIds } } },
      { new: true },
    );
    return doc ? doc.toJSON() : null;
  }

  static async ensureAdminUser(email: string, logger: any): Promise<void> {
    const existing = await User.findOne({ email });
    if (!existing) {
      await User.findOneAndUpdate(
        { email },
        {
          $setOnInsert: {
            email,
            roles: ["admin"],
            name: "Admin User",
          },
        },
        { upsert: true, new: true },
      );
      logger.info(`Admin user created: ${email}`);
      // Send connection instructions email to the admin
      const adminUser = await User.findOne({ email });
      if (adminUser) {
        // Use the instance method, so create a temp instance
        const repo = new UserRepository();
        await repo.sendConnectionInstructionsEmail(
          adminUser,
          "Welcome! Your admin account has been created. Here are your credentials and instructions to connect to the MCP server.",
        );
      }
    } else {
      logger.info(`Admin user exists: ${email}`);
    }
    // Log the admin user's apiKey for admin visibility
    const adminUser = await User.findOne({ email });
    if (adminUser) {
      logger.info(
        `[AUTH] Admin user: email=${adminUser.email}, apiKey=${adminUser.apiKey}`,
      );
    }
  }

  async removeUser(email: string): Promise<boolean> {
    const result = await User.deleteOne({ email });
    return result.deletedCount > 0;
  }

  async getUserToolsInternal(email: string): Promise<any[]> {
    const user = await this.findByEmail(email);
    if (!user) return [];

    // Admins get all tools
    if (user.roles?.includes("admin")) {
      return Tool.find({}).lean();
    }

    const userRoles = user.roles || [];
    const sharedToolNames = (user.sharedTools || []).map((t) => t.toolId);

    const query: any = {
      $or: [
        { name: { $in: sharedToolNames } },
        { creator: user.email },
        { creator: "system" },
      ],
    };

    if (userRoles.length > 0) {
      query.$or.push({ rolesPermitted: { $in: userRoles } });
    }

    // Find all tools the user could have access to
    const allUserTools = await Tool.find(query).lean();

    return allUserTools;
  }

  async getUserTools(email: string): Promise<any[]> {
    const user = await this.findByEmail(email);
    if (!user) return [];
    const hiddenTools = user.hiddenTools || []; // Contains namespacedName values
    const allUserTools = await this.getUserToolsInternal(email);

    // Detect conflicts by grouping by simple name
    const toolsByName: { [key: string]: any[] } = {};
    allUserTools.forEach((tool: any) => {
      if (!toolsByName[tool.name]) {
        toolsByName[tool.name] = [];
      }
      toolsByName[tool.name].push(tool);
    });

    const conflicts: { [key: string]: { count: number; creators: string[] } } = {};
    Object.entries(toolsByName).forEach(([name, toolList]) => {
      if (toolList.length > 1) {
        conflicts[name] = {
          count: toolList.length,
          creators: toolList.map((t: any) => t.creator)
        };
      }
    });

    // Return tool objects with conflict information
    return allUserTools.map((tool: any) => {
      const namespacedName = `${tool.creator}:${tool.name}`;
      const alwaysVisible = !!tool.alwaysVisible;
      const hidden = alwaysVisible ? false : hiddenTools.includes(namespacedName);
      
      return {
        ...tool, // includes all DB fields: name, description, inputSchema, handler, rolesPermitted, annotations, etc.
        namespacedName,
        hidden,
        alwaysVisible,
        hasConflict: !!conflicts[tool.name],
        conflictInfo: conflicts[tool.name]
      };
    });
  }

  async findByApiKey(apiKey: string): Promise<IUser | null> {
    const doc = await User.findOne({ apiKey });
    return doc ? doc.toJSON() : null;
  }

  /**
   * Get the authentication parameters for a specific application key.
   */
  async getAppParams(email: string, appKey: string): Promise<any | null> {
    const user = await User.findOne(
      { email },
      { [`applicationAuthentication.${appKey}`]: 1 },
    );
    return user?.applicationAuthentication?.[appKey] ?? null;
  }

  /**
   * Set the authentication parameters for a specific application key.
   * Only updates the specified app's auth data, preserving others.
   */
  async setAppParams(
    email: string,
    appKey: string,
    params: any,
  ): Promise<IUser | null> {
    const update = { [`applicationAuthentication.${appKey}`]: params };
    const doc = await User.findOneAndUpdate(
      { email },
      { $set: update },
      { new: true },
    );
    return doc ? doc.toJSON() : null;
  }

  /**
   * Send an email to the user with MCP server connection details and a custom message.
   * @param user The user object (must have email, name, apiKey)
   * @param customMessage A custom message to display at the top of the email
   */
  async sendConnectionInstructionsEmail(
    user: { email: string; name?: string; apiKey: string },
    customMessage: string,
  ) {
    const mcpName = config.server.mcpName;
    const serverUrl =
      config.server.url || "http(s)://<your-mcp-server-host>:<port>";
    const apiKey = user.apiKey;
    const clientConfig = `{
  "mcpServers": {
    "${mcpName}": {
      "url": "${serverUrl.replace(/\/?$/, "/mcp")}?apiKey=${apiKey}"
    }
  }
}`;
    const adminEmail = config.server.adminEmail;
    const contactLine = adminEmail
      ? `please contact your administrator at <a href=\"mailto:${adminEmail}\">${adminEmail}</a>.`
      : "please contact your administrator.";

    const subject = `Your MCP Server Connection Details for ${mcpName}`;
    const html = `
      <h2>${mcpName} MCP Server Connection</h2>
      <p>${customMessage}</p>
      <ul>
        <li><strong>Email:</strong> ${user.email}</li>
        <li><strong>API Key:</strong> ${user.apiKey}</li>
      </ul>
      <p>To connect an MCP client, configure it with the following:</p>
      <ul>
        <li><strong>Server URL:</strong> <code>${serverUrl}</code></li>
        <li><strong>Email:</strong> <code>${user.email}</code></li>
        <li><strong>API Key:</strong> <code>${user.apiKey}</code></li>
      </ul>
      <p>Typical MCP client configuration:</p>
      <pre><code>${clientConfig}</code></pre>
      <p>If you have any questions, ${contactLine}</p>
      <p>Thank you!</p>
    `;
    await sendEmail({ to: user.email, subject, html });
  }
  /**
   * Remove a tool from hiddenTools arrays of users who had access to it.
   * This should be called when a tool is deleted to prevent confusion
   * if a tool with the same name is created later.
   *
   * @param toolName - The name of the tool being deleted
   * @param toolCreator - The creator of the tool being deleted
   * @param rolesPermitted - The roles that had access to the tool
   */
  async removeToolFromHiddenToolsForAuthorizedUsers(
    toolName: string,
    toolCreator: string,
    rolesPermitted?: string[]
  ): Promise<void> {
    const namespacedName = `${toolCreator}:${toolName}`;
    
    // Build query to find users who had access to this tool
    const accessQuery: any = {
      $or: [
        // Users who created the tool
        { email: toolCreator },
        // Users who had the tool shared with them
        { "sharedTools.toolId": toolName }
      ]
    };

    // If the tool had role-based permissions, include users with those roles
    if (rolesPermitted && rolesPermitted.length > 0) {
      accessQuery.$or.push({ roles: { $in: rolesPermitted } });
    }

    // Only update users who both had access AND had hidden the tool (using namespacedName)
    await User.updateMany(
      {
        $and: [
          accessQuery,
          { hiddenTools: namespacedName }
        ]
      },
      { $pull: { hiddenTools: namespacedName } }
    );
  }
}
