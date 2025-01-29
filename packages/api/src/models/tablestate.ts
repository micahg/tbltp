import { HydratedTokenInstance, Rect } from "@micahg/tbltp-common";

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
