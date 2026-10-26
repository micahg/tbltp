import type { DrawContext, DrawableToken } from "../drawing";
import { createPoints, firstZoomStep } from "../geometry";
import type { WorkerPost, WorkerState } from "./state";
import { ZOOM_STEP } from "./state";
import { playerThings, renderThings } from "./things";
import {
  adjustZoomFromViewport,
  calculateViewport,
  unrotateBox,
  unrotateScaleTranslatePoints,
} from "./viewport";

/**
 * Composite the background image and all offscreen layers down to the single
 * visible canvas, cropped to the viewport and rotated to the display angle.
 */
export function renderDisplay(state: WorkerState): void {
  const ctx = state.layers.visible;
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!state.layers.background && state.layers.composition.length === 0) return;
  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate((state.view.angle * Math.PI) / 180);
  // we ctx.rotate above, so REMEMBER: the actual source images SHOULD NOT BE ROTATED
  const draw = (src: CanvasImageSource) =>
    ctx.drawImage(
      src,
      state.view.image.x,
      state.view.image.y,
      state.view.image.width,
      state.view.image.height,
      // the viewport, on the other hand, does need to accommodate that rotation since
      // we are on a mostly statically sized canvas but width and height might be rotated
      -state.view.viewport.width / 2,
      -state.view.viewport.height / 2,
      state.view.viewport.width,
      state.view.viewport.height,
    );
  if (state.layers.background) draw(state.layers.background);
  ctx.globalAlpha = state.settings.displayOpacity;
  state.layers.composition.forEach(draw);
  ctx.restore();
  renderStreamFrame(state);
}

/**
 * Render the player view (the requested viewport, as shown by the remote
 * display) onto the fixed-resolution stream canvas and ship it to the main
 * thread as an ImageBitmap for recording.
 *
 * The stream surface is independent of the GM canvas: it uses the player
 * background, placed tokens and the overlay at full opacity. GM-only
 * affordances (the viewport guide, brush and selection previews) live on the
 * GM's canvases only and never appear here.
 */
export function renderStreamFrame(state: WorkerState): void {
  const stream = state.stream;
  if (!stream.on || !stream.ctx) return;
  const post = state.post;
  if (!post) return;

  // the player image is what the stream must show; fall back to the GM
  // background when no separate player image was loaded
  const background = state.layers.playerBackground ?? state.layers.background;
  if (!background) return;

  // renderDisplay (and thus this) runs at animation-frame rates during
  // drags -- throttle the frames we ship to the stream rate
  const now = performance.now();
  const interval = 1000 / (stream.fps > 0 ? stream.fps : 30);
  if (stream.lastFrame > 0 && now - stream.lastFrame < interval) return;
  stream.lastFrame = now;

  // recompute the stream view every frame -- same fit as the remote display:
  // the requested viewport centered with its short side extended to fill
  const view = stream.view;
  view.angle = state.view.angle;
  if (view.requested.x < 0) {
    // no viewport requested: show the full background
    view.requested = {
      x: 0,
      y: 0,
      width: background.width,
      height: background.height,
    };
  }
  adjustZoomFromViewport(view);
  calculateViewport(view, background.width, background.height);

  const ctx = stream.ctx;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate((view.angle * Math.PI) / 180);
  const draw = (src: CanvasImageSource) =>
    ctx.drawImage(
      src,
      view.image.x,
      view.image.y,
      view.image.width,
      view.image.height,
      -view.viewport.width / 2,
      -view.viewport.height / 2,
      view.viewport.width,
      view.viewport.height,
    );
  draw(background);

  // placed tokens, drawn directly at stream scale (they draw in background
  // coordinates, so the viewport mapping handles positioning and size)
  const tokens = playerThings(state.things);
  if (tokens.length > 0) {
    ctx.save();
    ctx.translate(-view.viewport.width / 2, -view.viewport.height / 2);
    ctx.scale(
      view.viewport.width / view.image.width,
      view.viewport.height / view.image.height,
    );
    ctx.translate(-view.image.x, -view.image.y);
    for (const thing of tokens) {
      ctx.save();
      try {
        thing.draw(ctx);
      } catch (err) {
        console.error(err);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // the player view composites the overlay on top of the tokens (the remote
  // display renders things below the overlay) at full opacity
  const overlay = state.layers.full?.canvas;
  if (overlay) draw(overlay);
  ctx.restore();

  // ship the frame -- transferring the bitmap avoids a copy
  const bitmap = ctx.canvas.transferToImageBitmap();
  post({ cmd: "stream_frame", bitmap }, [bitmap]);
}

/**
 * Resize the visible canvas.
 */
export function sizeVisibleCanvas(
  ctx: OffscreenCanvasRenderingContext2D | undefined,
  width: number,
  height: number,
): void {
  if (!ctx) return;
  ctx.canvas.width = width;
  ctx.canvas.height = height;
}

export function renderAllCanvases(state: WorkerState): void {
  if (!state.layers.background) return;
  sizeVisibleCanvas(
    state.layers.visible,
    state.view.canvas.width,
    state.view.canvas.height,
  );
  renderThings(state.layers.things, state.things);
  renderDisplay(state);
}

export function renderToken(
  ctx: DrawContext | undefined,
  token: DrawableToken | undefined,
  zoom: number | undefined,
  place = false,
): void {
  if (!ctx || !token) return;
  ctx.save();
  if (place) token.place(ctx, zoom ?? 0);
  else token.draw(ctx);
  ctx.restore();
}

export function renderBrush(
  state: WorkerState,
  x: number,
  y: number,
  radius: number,
  full = true,
): void {
  if (!full) {
    const ctx = state.layers.visible;
    if (!ctx) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    return;
  }
  const ctx = state.layers.full;
  if (!ctx || state.view.zoom === undefined) return;
  // un-rotate, scale and translate
  const p = unrotateScaleTranslatePoints(state.view, createPoints([x, y]))[0];
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.round(radius * state.view.zoom), 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  // dump to visible canvas
  renderDisplay(state);
}

export function renderBox(
  state: WorkerState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: string,
  full = true,
): void {
  if (!full) {
    const ctx = state.layers.visible;
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = style;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.restore();
    return;
  }

  const ctx = state.layers.full;
  if (!ctx) return;
  const [x, y, w, h] = unrotateBox(state.view, x1, y1, x2, y2);
  ctx.save();
  ctx.fillStyle = style;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  renderDisplay(state);
}

export function eraseBrush(
  state: WorkerState,
  x: number,
  y: number,
  radius: number,
): void {
  const ctx = state.layers.full;
  if (!ctx || state.view.zoom === undefined) return;
  // un-rotate, scale and translate
  const p = unrotateScaleTranslatePoints(state.view, createPoints([x, y]))[0];

  // copy image so we can clip it shortly
  const img = ctx.canvas.transferToImageBitmap();

  ctx.save();
  // pay close attention here, rect is clockwise, arc is anticlockwise (last param)
  // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing#inverse_clipping_path)
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.arc(p.x, p.y, Math.round(radius * state.view.zoom), 0, 2 * Math.PI, true);
  ctx.clip();
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  img.close();
  renderDisplay(state);
}

export function clearBox(
  state: WorkerState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const ctx = state.layers.full;
  if (!ctx) return;
  const [x, y, w, h] = unrotateBox(state.view, x1, y1, x2, y2);
  ctx.clearRect(x, y, w, h);
  renderDisplay(state);
}

export function clearCanvas(state: WorkerState): void {
  const ctx = state.layers.full;
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  renderDisplay(state);
}

export function fullRerender(state: WorkerState, zoomOut = false): void {
  /**
   * Full render is called when the image, angle or zoom changes - hence the
   * recalculation of rotated width and height, zoom, and viewports
   */
  const background = state.layers.background;
  if (!background) return;
  const { view } = state;
  view.maxZoom = Math.max(
    view.fullRotW / view.canvas.width,
    view.fullRotH / view.canvas.height,
  );
  view.firstZoomStep = firstZoomStep(view.maxZoom, ZOOM_STEP);
  // this might get weird for rotation -- maybe it belongs in calculateCanvasses...
  if (view.zoom === undefined || view.zoom > view.maxZoom || zoomOut) {
    view.zoom = view.maxZoom;
    view.image.x = 0;
    view.image.y = 0;
  }
  adjustZoomFromViewport(view);
  calculateViewport(view, background.width, background.height);
  renderAllCanvases(state);
}

/**
 * Store the updated overlay canvas buffers, update the un-rotated image, and
 * ship it to the main thread for upload unless told not to.
 */
export function storeOverlay(
  state: WorkerState,
  post: WorkerPost,
): Promise<void> {
  const ctx = state.layers.full;
  if (!ctx) return Promise.resolve();
  return ctx.canvas
    .convertToBlob()
    .then((blob: Blob) => post({ cmd: "overlay", blob }))
    .catch((err) =>
      console.error(`Unable to post blob: ${JSON.stringify(err)}`),
    );
}
