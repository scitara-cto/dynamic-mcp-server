import { Tool, ITool } from "../models/Tool.js";

export class ToolRepository {
  async findByName(name: string): Promise<ITool | null> {
    const doc = await Tool.findOne({ name });
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

  async deleteTool(name: string): Promise<boolean> {
    const result = await Tool.deleteOne({ name });
    return result.deletedCount > 0;
  }

  async upsertMany(tools: Partial<ITool>[]): Promise<void> {
    for (const tool of tools) {
      await Tool.updateOne(
        { name: tool.name },
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
}
