import { Tool, ITool } from "../models/Tool.js";
import { ToolDefinition } from "../../mcp/types.js";
import { handlerPackages } from "../../handlers/index.js";

export class ToolRepository {
  async findByName(name: string): Promise<ITool | null> {
    const doc = await Tool.findOne({ name });
    return doc ? doc.toJSON() : null;
  }

  async findByNameAndCreator(name: string, creator: string): Promise<ITool | null> {
    const doc = await Tool.findOne({ name, creator });
    return doc ? doc.toJSON() : null;
  }

  async findByNamespacedName(namespacedName: string): Promise<ITool | null> {
    const [creator, name] = namespacedName.split(':');
    if (!creator || !name) return null;
    
    const doc = await Tool.findOne({ name, creator });
    return doc ? doc.toJSON() : null;
  }

  async create(tool: Partial<ITool>): Promise<ITool> {
    if (!tool.name) {
      throw new Error("Tool name is required");
    }
    if (!tool.creator) {
      throw new Error("Tool creator is required");
    }
    const newTool = new Tool(tool);
    const saved = await newTool.save();
    return saved.toJSON();
  }

  async updateTool(
    name: string,
    updates: Partial<ITool>,
  ): Promise<ITool | null> {
    const doc = await Tool.findOneAndUpdate(
      { name },
      { $set: updates },
      { new: true },
    );
    return doc ? doc.toJSON() : null;
  }

  async list(
    params: { nameContains?: string; skip?: number; limit?: number } = {},
  ): Promise<ITool[]> {
    const { nameContains, skip = 0, limit = 20 } = params;
    const filter: any = {};
    if (nameContains) {
      filter.name = { $regex: nameContains, $options: "i" };
    }
    const docs = await Tool.find(filter).skip(skip).limit(limit);
    return docs.map((doc) => doc.toJSON());
  }

  async deleteTool(name: string): Promise<void> {
    const result = await Tool.deleteOne({ name });
    if (result.deletedCount === 0) {
      throw new Error(`Tool with name '${name}' not found`);
    }
  }

  async upsertMany(tools: Partial<ITool>[]): Promise<void> {
    for (const tool of tools) {
      await Tool.updateOne(
        { name: tool.name, creator: tool.creator },
        { $set: tool },
        { upsert: true },
      );
    }
  }

  async findByNames(names: string[]): Promise<ITool[]> {
    if (!names.length) return [];
    const docs = await Tool.find({ name: { $in: names } });
    return docs.map((doc) => doc.toJSON());
  }

  async findAll(): Promise<ITool[]> {
    const docs = await Tool.find({});
    return docs.map((doc) => doc.toJSON());
  }

  async getAvailableToolsForUser(
    user: {
      email: string;
      roles?: string[];
      sharedTools?: { toolId: string }[];
    },
    serverName: string = "system",
  ): Promise<ToolDefinition[]> {
    const allTools = await this.findAll();
    const userRoles = user.roles || [];
    const sharedToolNames = (user.sharedTools || []).map((t) => t.toolId);
    return allTools
      .filter(
        (tool) =>
          (tool.rolesPermitted &&
            tool.rolesPermitted.some((role) => userRoles.includes(role))) ||
          sharedToolNames.includes(tool.name) ||
          tool.creator === user.email ||
          tool.creator === "system" ||
          tool.creator === serverName,
      )
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        handler: tool.handler,
        rolesPermitted: tool.rolesPermitted,
      }));
  }

  /**
   * Delete all system tools and re-add the current set from handlerPackages.
   */
  async resetSystemTools(): Promise<void> {
    await Tool.deleteMany({ creator: "system" });
    const builtinTools = handlerPackages
      .flatMap((pkg: any) => pkg.tools)
      .map((tool: any) => ({
        ...tool,
        creator: "system",
      }));
    await this.upsertMany(builtinTools);
  }
}
