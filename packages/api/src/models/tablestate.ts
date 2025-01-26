import { Rect } from "@micahg/tbltp-common";
import { ITokenInstance } from "./tokeninstance";

export interface TableState {
  overlay?: string;
  overlayRev?: number;
  background?: string;
  backgroundRev?: number;
  viewport: Rect;
  angle: number;
  backgroundSize?: Rect;
  tokens: ITokenInstance[];
}
