import { ToolDefinition, RuntimeToolDefinition } from "../types.js";

export class ToolRegistry {
  private tools: Map<string, RuntimeToolDefinition> = new Map();
  private handlerFactory: Record<string, (config: any) => any> = {};

  registerHandlerFactory(type: string, factory: (config: any) => any): void {
    this.handlerFactory[type] = factory;
  }

  async registerTool({
    name,
    description,
    inputSchema,
    annotations,
    handler: { type, config },
  }: ToolDefinition): Promise<void> {
    const factory = this.handlerFactory[type];
    if (!factory) {
      throw new Error(`Unknown handler type: ${type}`);
    }
    const handler = factory(config);
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      annotations,
      handler,
    });
  }

  getTool(name: string): RuntimeToolDefinition | undefined {
    return this.tools.get(name);
  }

  getRegisteredToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  async removeTool(name: string): Promise<boolean> {
    return this.tools.delete(name);
  }

  getAllTools(): Iterable<RuntimeToolDefinition> {
    return this.tools.values();
  }
}
