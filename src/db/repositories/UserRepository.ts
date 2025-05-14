import { User, IUser } from "../models/User.js";

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    const doc = await User.findOne({ email });
    return doc ? doc.toJSON() : null;
  }

  async create(user: Partial<IUser>): Promise<IUser> {
    if (!user.email) {
      throw new Error("User email is required");
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
    if (!toolDef || !Array.isArray(toolDef.rolesPermitted)) return false;
    // Check if user has any permitted role
    const userRoles = user.roles || [];
    return userRoles.some((role) => toolDef.rolesPermitted!.includes(role));
  }

  async addUsedTools(email: string, toolIds: string[]): Promise<IUser | null> {
    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      throw new Error("toolIds must be a non-empty array");
    }
    const doc = await User.findOneAndUpdate(
      { email },
      { $addToSet: { usedTools: { $each: toolIds } } },
      { new: true },
    );
    return doc ? doc.toJSON() : null;
  }

  async removeUsedTools(
    email: string,
    toolIds: string[],
  ): Promise<IUser | null> {
    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      throw new Error("toolIds must be a non-empty array");
    }
    const doc = await User.findOneAndUpdate(
      { email },
      { $pull: { usedTools: { $in: toolIds } } },
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
  }

  async removeUser(email: string): Promise<boolean> {
    const result = await User.deleteOne({ email });
    return result.deletedCount > 0;
  }
}
