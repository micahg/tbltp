export interface Rect {
  x: number,
  y: number,
  width: number,
  height: number,
}

/**
 * Table state. In the future this should be in mongo if we need persistance
 * across runs or whatever.
 */
export interface TableState {
  overlay?: string;
  background?: string;
  viewport: Rect;
  angle: number;
  backgroundSize?: Rect;
}