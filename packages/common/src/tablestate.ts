import { Rect } from "./geometry";

export interface TableState {
    overlay?: string;
    overlayRev?: number;
    background?: string;
    backgroundRev?: number;
    viewport: Rect;
    angle: number;
    backgroundSize?: Rect;
  }
  