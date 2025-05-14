import { ToolRepository } from "./repositories/ToolRepository.js";
import { UserRepository } from "./repositories/UserRepository.js";
import logger from "../utils/logger.js";
import { builtInTools } from "../handlers/index.js";
import { Tool } from "./models/Tool.js";

export async function syncBuiltinTools(): Promise<string[]> {
  const toolRepo = new ToolRepository();
  const builtinTools = builtInTools.map((tool: any) => ({
    ...tool,
    creator: "system",
  }));
  await toolRepo.upsertMany(builtinTools);
  logger.info("Bootstrapped built-in tools into the tools collection");

  const builtinToolNames = new Set(builtinTools.map((t: any) => t.name));
  const dbBuiltinTools = await toolRepo.list({});
  const removedToolNames: string[] = [];
  for (const tool of dbBuiltinTools) {
    if (tool.creator === "system" && !builtinToolNames.has(tool.name)) {
      await toolRepo.deleteTool(tool.name);
      removedToolNames.push(tool.name);
      logger.info(`Removed stale built-in tool from DB: ${tool.name}`);
    }
  }
  return removedToolNames;
}

export async function cleanupUserToolReferences(
  removedToolNames: string[],
): Promise<void> {
  if (!removedToolNames.length) return;
  const userRepo = new UserRepository();
  const users = await userRepo.list({ skip: 0, limit: 10000 });
  for (const user of users) {
    let changed = false;
    if (user.sharedTools) {
      const filtered = user.sharedTools.filter(
        (st: any) => !removedToolNames.includes(st.toolId),
      );
      if (filtered.length !== user.sharedTools.length) {
        user.sharedTools = filtered;
        changed = true;
      }
    }
    if (changed) {
      await userRepo.updateUser(user.email, {
        sharedTools: user.sharedTools,
      });
      logger.info(`Cleaned up stale tool references for user: ${user.email}`);
    }
  }
}
