/**
 * IMPORTANT: Do not change the interfaces in this file without also reviewing the corresponding
 * mongoose models and (if applicable) omitting/redefining the types.
 */
import { Rect } from "./geometry";
import { HydratedTokenInstance } from "./tokeninstance";

export interface TableState {
  overlay?: string;
  overlayRev?: number;
  background?: string;
  backgroundRev?: number;
  viewport: Rect;
  angle: number;
  backgroundSize?: Rect;
  tokens: HydratedTokenInstance[];
}