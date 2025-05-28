import { User, IUser } from "../models/User.js";
import { Tool } from "../models/Tool.js";
import { randomUUID } from "crypto";

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
    const doc = await User.findOneAndUpdate(
      { email },
      { $addToSet: { hiddenTools: { $each: toolIds } } },
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
    const doc = await User.findOneAndUpdate(
      { email },
      { $pull: { hiddenTools: { $in: toolIds } } },
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

  async getUserTools(email: string): Promise<any[]> {
    const user = await this.findByEmail(email);
    if (!user) return [];
    const hiddenTools = user.hiddenTools || [];
    const userRoles = user.roles || [];
    const sharedToolNames = (user.sharedTools || []).map((t) => t.toolId);

    return await Tool.find({
      $and: [
        {
          $or: [
            { name: { $in: sharedToolNames } },
            { creator: user.email },
            { rolesPermitted: { $elemMatch: { $in: userRoles } } },
          ],
        },
        {
          name: { $nin: hiddenTools },
        },
      ],
    }).lean();
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
}
