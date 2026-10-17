/**
 * IMPORTANT: Do not change the interfaces in this file without also reviewing the corresponding
 * mongoose models and (if applicable) omitting/redefining the types.
 */
import { Rect } from "./geometry";
import { HydratedTokenInstance } from "./tokeninstance";

export interface TableState {
  overlay?: string;
  overlayRev?: number;
  /**
   * Presigned download url for the overlay. Freshly signed for every
   * serialization; the worker must key its cache by (overlay, overlayRev)
   * so a new url alone never forces a refetch.
   */
  overlayUrl?: string;
  background?: string;
  backgroundRev?: number;
  /**
   * Presigned download url for the background (same caching contract as
   * overlayUrl).
   */
  backgroundUrl?: string;
  viewport: Rect;
  angle: number;
  backgroundSize?: Rect;
  tokens: HydratedTokenInstance[];
}