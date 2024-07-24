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
  overlayRev?: number;
  background?: string;
  backgroundRev?: number;
  viewport: Rect;
  angle: number;
  backgroundSize?: Rect;
}
