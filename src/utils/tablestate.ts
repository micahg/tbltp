export interface Rect {
  x: number,
  y: number,
  width: number,
  height: number,
};

/**
 * Table state. In the future this should be in mongo if we need persistance
 * across runs or whatever.
 */
export interface TableState {
  overlay?: string;
  background?: string;
  viewport: Rect;
}


const state: TableState = {
  overlay: null,
  background: null,
  viewport: null,
}

export function updateTableState(layer: string, asset: string | Rect): void {
  if      (layer === 'background') state.background = asset as string;
  else if (layer === 'overlay')    state.overlay = asset as string;
  else if (layer === 'viewport')   state.viewport = asset as Rect;
}

export function getTableState(): TableState { return state; }