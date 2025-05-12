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
    const user = await User.findOne({
      email,
      $or: [{ allowedTools: toolId }, { "sharedTools.toolId": toolId }],
    });
    return !!user;
  }

  static async ensureAdminUser(email: string, logger: any): Promise<void> {
    const repo = new UserRepository();
    const adminUser = await repo.findByEmail(email);
    if (!adminUser) {
      await repo.create({
        email,
        roles: ["admin"],
        name: "Admin User",
        allowedTools: [
          "list-users",
          "add-user",
          "update-user",
          "delete-user",
          "list-tools",
          "delete-tool",
        ],
      });
      logger.info(`Admin user created: ${email}`);
    } else {
      logger.info(`Admin user exists: ${email}`);
    }
  }
}
