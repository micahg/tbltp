import type { DrawContext, DrawableToken } from "../drawing";
import { createPoints, firstZoomStep } from "../geometry";
import type { WorkerPost, WorkerState } from "./state";
import { ZOOM_STEP } from "./state";
import { renderThings } from "./things";
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
