/**
 * IMPORTANT: Do not change the interfaces in this file without also reviewing the corresponding
 * mongoose models and (if applicable) omitting/redefining the types.
 */
import { Rect } from "./geometry";
import { TokenInstance } from "./tokeninstance";

export interface Scene {
  _id?: string;
  user: string;
  description: string;
  overlayId?: string;
  detailId?: string;
  playerId?: string;
  viewport?: Rect;
  backgroundSize?: Rect;
  angle?: number;
  tokens?: TokenInstance[];
}