import { SessionToolManager } from "../SessionToolManager.js";
import { ToolGenerator } from "../ToolGenerator.js";
import { jest } from "@jest/globals";

describe("SessionToolManager", () => {
  it("initializes session tool set and getAllowedTools returns correct set", () => {
    const tools = ["a", "b", "c"];
    const mgr = new SessionToolManager(() => tools);
    mgr.updateSessionTools("sess1", {});
    const allowed = mgr.getAllowedTools("sess1");
    expect(allowed).toBeDefined();
    expect(Array.from(allowed!)).toEqual(expect.arrayContaining(tools));
  });

  it("cleanupSession removes the session tool set", () => {
    const mgr = new SessionToolManager(() => ["x"]);
    mgr.updateSessionTools("sess2", {});
    expect(mgr.getAllowedTools("sess2")).toBeDefined();
    mgr.cleanupSession("sess2");
    expect(mgr.getAllowedTools("sess2")).toBeUndefined();
  });

  it("session tool sets are isolated", () => {
    const mgr = new SessionToolManager(() => ["a", "b"]);
    mgr.updateSessionTools("sessA", {});
    mgr.updateSessionTools("sessB", {});
    mgr.getAllowedTools("sessA")!.delete("a");
    expect(mgr.getAllowedTools("sessA")).not.toContain("a");
    expect(mgr.getAllowedTools("sessB")).toContain("a");
  });

  it("removing a tool from ToolGenerator removes it from all sessions", async () => {
    const mockServer = {
      setRequestHandler: jest.fn(),
      registerCapabilities: jest.fn(),
    } as any;
    const mockMcpServer = {} as any;
    const mockUserRepo = { findByEmail: jest.fn() } as any;
    const toolGen = new ToolGenerator(mockServer, mockMcpServer, mockUserRepo);
    toolGen.registerHandlerFactory("test", () => async () => ({ result: 1 }));
    const tool = {
      name: "removable",
      description: "",
      inputSchema: {},
      handler: { type: "test", config: {} },
    };
    await toolGen.publishTool(tool);
    (toolGen as any).sessionToolManager.updateSessionTools("sessX", {});
    (toolGen as any).sessionToolManager.updateSessionTools("sessY", {});
    expect(
      (toolGen as any).sessionToolManager.getAllowedTools("sessX"),
    ).toContain("removable");
    expect(
      (toolGen as any).sessionToolManager.getAllowedTools("sessY"),
    ).toContain("removable");
    await toolGen.removeTool("removable");
    expect(
      (toolGen as any).sessionToolManager.getAllowedTools("sessX"),
    ).not.toContain("removable");
    expect(
      (toolGen as any).sessionToolManager.getAllowedTools("sessY"),
    ).not.toContain("removable");
  });
});
