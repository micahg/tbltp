export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Table state.
 */
export interface TableState {
  overlay?: string;
  background?: string;
  viewport: Rect;
  angle: number;
  backgroundSize?: Rect;
}
