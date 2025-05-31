import { jest } from "@jest/globals";
import { syncBuiltinTools } from "../toolSync.js";
import { ToolRepository } from "../repositories/ToolRepository.js";
import { handlerPackages } from "../../handlers/index.js";
import logger from "../../utils/logger.js";

jest
  .spyOn(logger, "info")
  .mockImplementation((infoObject: object) => ({} as any));
jest
  .spyOn(logger, "debug")
  .mockImplementation((infoObject: object) => ({} as any));
jest
  .spyOn(logger, "error")
  .mockImplementation((infoObject: object) => ({} as any));

describe("syncBuiltinTools (mocked repo, ESM/TS safe)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("syncs built-in tools and removes stale ones (mocked repo)", async () => {
    const builtinNames = handlerPackages
      .flatMap((pkg) => pkg.tools)
      .map((t) => t.name);

    const now = new Date();
    const minimalTool = (name) => ({
      name,
      description: "",
      inputSchema: {},
      annotations: {},
      handler: { type: "test", config: {} },
      creator: "system",
      createdAt: now,
      updatedAt: now,
      rolesPermitted: ["admin"],
    });
    const upsertMany = jest
      .spyOn(ToolRepository.prototype, "upsertMany")
      .mockResolvedValue(undefined);
    const list = jest
      .spyOn(ToolRepository.prototype, "list")
      .mockResolvedValue([
        ...builtinNames.map((name) => minimalTool(name)),
        minimalTool("toolC"),
      ]);
    const deleteTool = jest
      .spyOn(ToolRepository.prototype, "deleteTool")
      .mockResolvedValue(undefined);

    const removed = await syncBuiltinTools();

    expect(upsertMany).toHaveBeenCalledWith(
      expect.arrayContaining(
        builtinNames.map((name) =>
          expect.objectContaining({ name, creator: "system" }),
        ),
      ),
    );
    expect(list).toHaveBeenCalled();
    expect(deleteTool).toHaveBeenCalledWith("toolC");
    expect(removed).toEqual(["toolC"]);
  });

  // it("returns empty array if no stale tools", async () => {
  //   // ... existing code ...
  // });
});
