import { Tool } from './types';
import { searchKbTool } from './tools/searchKb.tool';
import { lookupOrderTool } from './tools/lookupOrder.tool';
import { issueRefundTool } from './tools/issueRefund.tool';

/** Name -> Tool lookup plus the description list a planner needs to know what it may do.
 *  Registering a new capability is a one-line change here and nothing else in the loop,
 *  the persistence layer, or the API has to know about it. */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): { name: string; description: string }[] {
    return [...this.tools.values()].map((t) => ({ name: t.name, description: t.description }));
  }
}

// Tools are stateless — all I/O goes through the shared prisma singleton — so a fresh
// registry per run costs nothing and keeps runs from sharing mutable state.
export function buildRegistry(): ToolRegistry {
  return new ToolRegistry()
    .register(searchKbTool)
    .register(lookupOrderTool)
    .register(issueRefundTool);
}
