/**
 * Table state. In the future this should be in mongo if we need persistance
 * across runs or whatever.
 */
export interface TableState {
  overlay?: string;
  background?: string;
}


const state: TableState = {
  overlay: null,
  background: null,
}

export function updateTableState(layer: string, asset: string): void {
  if      (layer === 'background') state.background = asset;
  else if (layer === 'overlay')    state.overlay = asset;
}

export function getTableState(): TableState { return state; }