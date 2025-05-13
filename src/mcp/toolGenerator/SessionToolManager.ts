export class SessionToolManager {
  private sessionTools: Map<string, Set<string>> = new Map();
  private tools: () => Iterable<string>;

  constructor(toolsProvider: () => Iterable<string>) {
    this.tools = toolsProvider;
  }

  updateSessionTools(sessionId: string, context: any): void {
    const allTools = new Set<string>(this.tools());
    this.sessionTools.set(sessionId, allTools);
  }

  cleanupSession(sessionId: string): void {
    this.sessionTools.delete(sessionId);
  }
}
