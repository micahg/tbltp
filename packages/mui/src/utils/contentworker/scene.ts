import { LoadProgress, loadImage } from "../content";
import { copyRect, rotatedWidthAndHeight } from "../geometry";
import { clearCanvas, fullRerender, renderDisplay } from "./render";
import type { LayerState, TableUpdate, WorkerPost, WorkerState } from "./state";
import { renderThings, updateThings } from "./things";

export async function loadSceneLayers(
  layers: LayerState,
  update: TableUpdate,
  post: WorkerPost,
): Promise<{ background?: ImageBitmap; overlay?: ImageBitmap }> {
  const {
    background,
    backgroundRev,
    backgroundUrl,
    overlay,
    overlayRev,
    overlayUrl,
  } = update;
  const progress = (p: LoadProgress) => post({ cmd: "progress", evt: p });

  // gross - if we have a background image, only load it if the revision changed...
  // so here if we see no change we don't bother pulling the new image
  const bgsame =
    !!layers.background &&
    background === layers.backgroundKey.src &&
    backgroundRev === layers.backgroundKey.rev;
  const bgP = background
    ? bgsame
      ? Promise.resolve(layers.background as ImageBitmap)
      : loadImage(backgroundUrl || background, progress)
    : Promise.resolve(null);
  layers.backgroundKey.src = background || layers.backgroundKey.src;
  layers.backgroundKey.rev = backgroundRev || layers.backgroundKey.rev;

  // same idea for the overlay: only download it when the server announced a
  // new revision. A fresh presigned url alone must never force a refetch
  // (the browser cache key is the full url, which changes every broadcast).
  const ovsame =
    !!layers.overlay &&
    overlay === layers.overlayKey.src &&
    overlayRev === layers.overlayKey.rev;
  const ovP = overlay
    ? ovsame
      ? Promise.resolve(layers.overlay as ImageBitmap)
      : loadImage(overlayUrl || overlay, progress)
    : Promise.resolve(null);

  // TODO signal an error if either promise fails
  const [bgImg, ovImg] = await Promise.all([bgP, ovP]);

  // keep a copy of these to prevent having to recreate them from the image buffer
  if (bgImg) {
    layers.background = bgImg;
  }

  if (!overlay) {
    // no overlay at all -- drop the cached bitmap
    layers.overlay?.close();
    layers.overlay = undefined;
    layers.overlayKey.src = undefined;
    layers.overlayKey.rev = undefined;
  } else if (ovImg && ovImg !== layers.overlay) {
    // a fresh overlay was loaded -- the previous bitmap is no longer
    // referenced by any canvas and can be released
    layers.overlay?.close();
    layers.overlay = ovImg;
    layers.overlayKey.src = overlay;
    layers.overlayKey.rev = overlayRev;
  }

  return {
    background: bgImg ?? undefined,
    overlay: ovImg ?? undefined,
  };
}

export async function applyUpdate(
  state: WorkerState,
  values: TableUpdate,
  post: WorkerPost,
): Promise<void> {
  const { angle, background, viewport, things } = values;
  if (!background) {
    if (things) {
      await updateThings(state.things, things);
      renderThings(state.layers.things, state.things);
      renderDisplay(state);
      return;
    }
    console.error(`Ignoring update without background`);
    return;
  }
  state.view.angle = angle;
  void updateThings(state.things, things);

  if (viewport) {
    copyRect(viewport, state.view.requested);
  }

  try {
    const { background: bgImg, overlay: ovImg } = await loadSceneLayers(
      state.layers,
      values,
      post,
    );
    if (!bgImg) return;

    [state.view.fullRotW, state.view.fullRotH] = rotatedWidthAndHeight(
      state.view.angle,
      bgImg.width,
      bgImg.height,
    );

    const thingCanvas = new OffscreenCanvas(bgImg.width, bgImg.height);
    const thingCtx = thingCanvas.getContext("2d", {
      alpha: true,
    }) as OffscreenCanvasRenderingContext2D;
    state.layers.things = thingCtx;

    const fullCanvas = new OffscreenCanvas(bgImg.width, bgImg.height);
    const fullCtx = fullCanvas.getContext("2d", {
      alpha: true,
    }) as OffscreenCanvasRenderingContext2D;
    state.layers.full = fullCtx;

    // set the image rendering order (in reverse, things on top => things draw last)
    state.layers.composition = state.settings.thingsOnTop
      ? [fullCtx.canvas, thingCtx.canvas]
      : [thingCtx.canvas, fullCtx.canvas];

    // NOTE: the overlay bitmap is cached for future (no-change) updates, so
    // it must not be closed here
    if (ovImg) {
      fullCtx.drawImage(ovImg, 0, 0);
    } else {
      clearCanvas(state);
    }
    fullRerender(state, !viewport);
  } catch (err) {
    console.error(`Unable to load images on update: ${JSON.stringify(err)}`);
  }
}
