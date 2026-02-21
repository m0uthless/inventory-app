import type { GridRowId, GridRowSelectionModel } from "@mui/x-data-grid";

/**
 * MUI X DataGrid selection model shape changed across major versions.
 * This helper provides a tiny compatibility layer.
 */

export function emptySelectionModel(): GridRowSelectionModel {
  // v8 uses an object { type, ids: Set<GridRowId> }
  return ({ type: "include", ids: new Set<GridRowId>() } as any) as GridRowSelectionModel;
}

export function selectionToIds(model: GridRowSelectionModel): GridRowId[] {
  const m: any = model as any;

  // Newer versions: { type: "include" | "exclude", ids: Set<GridRowId> }
  if (m && typeof m === "object" && m.ids instanceof Set) {
    if (m.type && m.type !== "include") return [];
    return Array.from(m.ids.values());
  }

  // Older versions: GridRowId[]
  if (Array.isArray(m)) return m;

  return [];
}

export function selectionSize(model: GridRowSelectionModel): number {
  const m: any = model as any;

  if (m && typeof m === "object" && m.ids instanceof Set) {
    if (m.type && m.type !== "include") return 0;
    return m.ids.size || 0;
  }

  if (Array.isArray(m)) return m.length;

  return 0;
}

export function selectionToNumberIds(model: GridRowSelectionModel): number[] {
  return selectionToIds(model)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}
