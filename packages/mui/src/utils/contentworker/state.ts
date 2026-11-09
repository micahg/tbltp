import { Rect, TableState } from "@micahg/tbltp-common";
import type { Drawable, DrawableToken } from "../drawing";

export const MIN_BRUSH = 10;
export const GUIDE_FILL = "rgba(255, 255, 255, 0.25)";
export const ZOOM_STEP = 0.5;

export type TableUpdate = TableState & {
  things?: unknown[];
  /**
   * The player background (location/revision/url) when the editor loads a
   * separate detail image for the GM view. Absent means the player image is
   * the same asset as the background.
   */
  playerBackground?: string;
  playerBackgroundUrl?: string;
  playerBackgroundRev?: number;
};

export type WorkerPost = (message: unknown, transfer?: Transferable[]) => void;

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

  /**
   * The player background bitmap. The editor may load a detail image for the
   * GM view, but player-facing renders (the stream) must use the player
   * image. Usually the very same object as `background`.
   */
  playerBackground?: ImageBitmap;
  playerBackgroundKey: { src?: string; rev?: number };

  composition: CanvasImageSource[];
}

/**
 * State for the outbound stream: the worker renders the player view (the
 * requested viewport, as shown by the remote display) onto a fixed-resolution
 * offscreen canvas and ships each frame to the main thread as an ImageBitmap
 * for MediaRecorder -- the recorder itself cannot run in a worker.
 */
export interface StreamState {
  // whether stream frames should be rendered and shipped
  on: boolean;
  // stream frame rate, which paces the frame timer (set when the stream starts)
  fps: number;
  // the stream surface: an offscreen canvas at the stream resolution
  ctx?: OffscreenCanvasRenderingContext2D;
  // the player view rendered onto the stream canvas
  view: ViewState;
  // pending timer for the next frame (see streamTick)
  timer?: ReturnType<typeof setTimeout>;
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
  // the outbound stream surface (see StreamState)
  stream: StreamState;
  /**
   * The worker's postMessage, captured by the dispatcher so rendering helpers
   * can ship messages (with transferables) without threading post through
   * every call.
   */
  post?: WorkerPost;
}

function emptyViewState(): ViewState {
  return {
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
  };
}

export function createWorkerState(): WorkerState {
  return {
    view: emptyViewState(),
    layers: {
      backgroundKey: {},
      overlayKey: {},
      playerBackgroundKey: {},
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
    stream: {
      on: false,
      fps: 30,
      view: emptyViewState(),
    },
  };
}
