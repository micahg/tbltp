import { Rect, TableState } from "@micahg/tbltp-common";
import type { Drawable, DrawableToken } from "../drawing";

export const MIN_BRUSH = 10;
export const GUIDE_FILL = "rgba(255, 255, 255, 0.25)";
export const ZOOM_STEP = 0.5;

export type TableUpdate = TableState & {
  things?: unknown[];
};

export type WorkerPost = (message: unknown) => void;

export interface ViewState {
  // canvas width and height (sent from main thread)
  canvas: Rect;

  // region of images to display
  image: Rect;
  // the viewport originally requested for the scene
  requested: Rect;
  // the rotated viewport currently displayed
  viewport: Rect;

  angle: number;
  zoom?: number;
  maxZoom: number;
  firstZoomStep: number;

  // rotated image width and height - cached to avoid recalculation after load
  fullRotW: number;
  fullRotH: number;
}

export interface LayerState {
  visible?: OffscreenCanvasRenderingContext2D;
  full?: OffscreenCanvasRenderingContext2D;
  things?: OffscreenCanvasRenderingContext2D;

  background?: ImageBitmap;
  /**
   * The overlay is rewritten at the same location on every annotation, so
   * (location, revision) is its cache identity. Keeping the loaded bitmap
   * lets an update that only carries a re-signed url skip the download.
   */
  overlay?: ImageBitmap;
  backgroundKey: { src?: string; rev?: number };
  overlayKey: { src?: string; rev?: number };

  composition: CanvasImageSource[];
}

export interface PointerState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lastAnimX: number;
  lastAnimY: number;
}

export interface ToolState {
  recording: boolean;
  selecting: boolean;
  panning: boolean;
  token?: DrawableToken;
  brush: number;
  colour: { red: string; green: string; blue: string };
  // opacity of the brush/selection/token indicator
  // affects the overlay/things offscreen canvases
  renderOpacity: string;
  pointer: PointerState;
}

export interface WorkerSettings {
  thingsOnTop: boolean;
  // display opacity of the overlay/things layers
  // only affects GM view of overlay/things
  displayOpacity: number;
}

export interface WorkerState {
  view: ViewState;
  layers: LayerState;
  tools: ToolState;
  things: Drawable[];
  settings: WorkerSettings;
}

export function createWorkerState(): WorkerState {
  return {
    view: {
      canvas: { x: 0, y: 0, width: 0, height: 0 },
      image: { x: 0, y: 0, width: 0, height: 0 },
      requested: { x: -1, y: -1, width: -1, height: -1 },
      viewport: { x: 0, y: 0, width: 0, height: 0 },
      angle: 0,
      zoom: undefined,
      maxZoom: 0,
      firstZoomStep: 0,
      fullRotW: 0,
      fullRotH: 0,
    },
    layers: {
      backgroundKey: {},
      overlayKey: {},
      composition: [],
    },
    tools: {
      recording: false,
      selecting: false,
      panning: false,
      brush: MIN_BRUSH,
      colour: { red: "255", green: "0", blue: "0" },
      renderOpacity: "1",
      pointer: {
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        lastAnimX: -1,
        lastAnimY: -1,
      },
    },
    things: [],
    settings: {
      thingsOnTop: false,
      displayOpacity: 1,
    },
  };
}
