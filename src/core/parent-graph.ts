import { ConflictError, InvalidRequestError } from "../errors";

export interface ParentEdge {
  id?: string;
  import_ref?: string | null;
  parent_import_ref?: string | null;
}

function reference(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function assertValidParentGraph(edges: readonly ParentEdge[]): void {
  const graph = new Map<string, string | undefined>();
  for (const edge of edges) {
    const importRef = reference(edge.import_ref);
    if (!importRef) continue;
    if (graph.has(importRef)) {
      throw new ConflictError(`duplicate import ref ${JSON.stringify(importRef)}`);
    }
    graph.set(importRef, reference(edge.parent_import_ref));
  }

  for (const edge of edges) {
    const parentRef = reference(edge.parent_import_ref);
    if (parentRef && !graph.has(parentRef)) {
      throw new InvalidRequestError(
        `parent import ref ${JSON.stringify(parentRef)} was not found`,
      );
    }
  }

  const completed = new Set<string>();
  for (const start of graph.keys()) {
    if (completed.has(start)) continue;
    const path: string[] = [];
    const active = new Set<string>();
    let current: string | undefined = start;
    while (current && graph.has(current) && !completed.has(current)) {
      if (active.has(current)) {
        throw new InvalidRequestError(
          `cyclic parent refs involving ${JSON.stringify(current)}`,
        );
      }
      active.add(current);
      path.push(current);
      current = graph.get(current);
    }
    for (const ref of path) completed.add(ref);
  }
}
