// - test with brand new scene (that wont have a viewport)
import { LoadProgress, loadImage } from "./content";
import {
  createDrawable,
  Drawable,
  Drawables,
  DrawableToken,
  DrawContext,
  isDrawableType,
} from "./drawing";
import {
  Point,
  createPoints,
  firstZoomStep,
  normalizeRect,
  pointsFromRect,
  rectFromPoints,
  rot,
  rotateBackToBackgroundOrientation,
  rotatedWidthAndHeight,
  unrotatePoints,
  scalePoints,
  translatePoints,
  copyRect,
  zoomFromViewport,
  adjustImageToViewport,
} from "./geometry";
import { Rect, TableState } from "@micahg/tbltp-common";

/**
 * Worker for offscreen drawing in the content editor.
 */
let backgroundImage: ImageBitmap;
let backgroundImageRev: number;
let backgroundImageSrc: string;
let backgroundCtx: OffscreenCanvasRenderingContext2D;
let overlayCtx: OffscreenCanvasRenderingContext2D;
let fullCtx: OffscreenCanvasRenderingContext2D;
let thingCtx: OffscreenCanvasRenderingContext2D;
let imageCanvasses: CanvasImageSource[] = [];
let recording = false;
let selecting = false;
let panning = false;
let _angle: number;
let _zoom: number;
const _zoom_step = 0.5;
let _max_zoom: number;
let _first_zoom_step: number;
let _things_on_top_of_overlay = false;
let _token: DrawableToken | undefined = undefined;

// canvas width and height (sent from main thread)
const _canvas: Rect = { x: 0, y: 0, width: 0, height: 0 };

// region of images to display
const _img: Rect = { x: 0, y: 0, width: 0, height: 0 };
const _img_orig: Rect = { x: -1, y: -1, width: -1, height: -1 };

// viewport
const _vp: Rect = { x: 0, y: 0, width: 0, height: 0 };

const _things: Drawable[] = [];

// rotated image width and height - cached to avoid recalculation after load
let _fullRotW: number;
let _fullRotH: number;

let startX: number, startY: number, endX: number, endY: number;
let lastAnimX = -1;
let lastAnimY = -1;

const MIN_BRUSH = 10;
const GUIDE_FILL = "rgba(255, 255, 255, 0.25)";
let opacity = "1";
let red = "255";
let green = "0";
let blue = "0";
let brush = MIN_BRUSH;

export type TableUpdate = TableState & {
  apiUrl: string;
  bearer: string;
  things?: unknown[];
};

function trimPanning() {
  if (_img.x <= 0) _img.x = 0;
  if (_img.y <= 0) _img.y = 0;

  // if viewport > image then panning gets weird
  if (_img.width >= backgroundImage.width) _img.x = 0;
  else if (_img.x + _img.width > backgroundImage.width)
    _img.x = backgroundImage.width - _img.width;
  if (_img.height >= backgroundImage.height) _img.y = 0;
  else if (_img.y + _img.height > backgroundImage.height)
    _img.y = backgroundImage.height - _img.height;
}

function renderImage(
  ctx: OffscreenCanvasRenderingContext2D,
  img: CanvasImageSource[],
  angle: number,
) {
  // if (debug) {
  // console.log(`*****`);
  // console.log(`translate ${ctx.canvas.width / 2}, ${ctx.canvas.height / 2}`);
  // console.log(
  //   `draw ${_img.x}, ${_img.y}, ${_img.width}, ${_img.height}, ${-_vp.width / 2}, ${
  //     -_vp.height / 2
  //   }, ${_vp.width}, ${_vp.height}`,
  // );
  // console.log(`*****`);
  // }

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  img.forEach((src) => {
    ctx.drawImage(
      src,
      // we ctx.rotate above, so REMEMBER: the actual source image SHOULD NOT BE ROTATED
      _img.x,
      _img.y,
      _img.width,
      _img.height,
      // the viewport, on the other hand, does need to accommodate that rotation since
      // we are on a mostly statically sized canvas but width and height might be rotated
      -_vp.width / 2,
      -_vp.height / 2,
      _vp.width,
      _vp.height,
    );
  });
  ctx.restore();
}

function calculateViewport() {
  // REMEMBER THIS METHOD UPDATES THE _vp and the _img
  adjustImageToViewport(
    _angle,
    _zoom,
    _canvas.width,
    _canvas.height,
    backgroundImage.width,
    backgroundImage.height,
    _vp,
    _img,
  );
  return;
}

/**
 * Given a desired viewport, set our current viewport accordingly, set the zoom,
 * and then center the request viewport within our screen, extending its short
 * side to fit our screen.
 *
 * This is used when the remote client is told which region to display, rather
 * than in the editor, where (iirc) you calculate the viewpoint given a point,
 * a zoom level and the canvas size.
 */
function adjustZoomFromViewport() {
  // if we do not have a requested image region to view then exit this method
  if (_img_orig.x < 0) return;

  // set our viewport to the initial value requested
  copyRect(_img_orig, _img);

  _zoom = zoomFromViewport(_angle, _canvas.width, _canvas.height, _img);
}

/**
 * Resize all visible canvasses.
 *
 * @param angle
 * @param width
 * @param height
 * @returns
 */
function sizeVisibleCanvasses(width: number, height: number) {
  backgroundCtx.canvas.width = width;
  backgroundCtx.canvas.height = height;
  overlayCtx.canvas.width = width;
  overlayCtx.canvas.height = height;
}

function loadAllImages(update: TableUpdate) {
  const { bearer, background, backgroundRev, overlay } = update;
  const progress = (p: LoadProgress) =>
    postMessage({ cmd: "progress", evt: p });

  // gross - if we have a background image, only load it if the revision changed...
  // so here if we see no change we don't bother pulling the new image
  const bgsame =
    background === backgroundImageSrc && backgroundRev === backgroundImageRev;
  const bgP = background
    ? bgsame
      ? Promise.resolve(backgroundImage)
      : loadImage(background, bearer, progress)
    : Promise.resolve(null);
  backgroundImageSrc = background || backgroundImageSrc;
  backgroundImageRev = backgroundRev || backgroundImageRev;
  const ovP = overlay
    ? loadImage(overlay, bearer, progress)
    : Promise.resolve(null);
  // TODO signal an error if either promise fails
  return Promise.all([bgP, ovP]).then(([bgImg, ovImg]) => {
    // keep a copy of these to prevent having to recreate them from the image buffer
    if (bgImg) {
      backgroundImage = bgImg;
      [_fullRotW, _fullRotH] = rotatedWidthAndHeight(
        _angle,
        bgImg.width,
        bgImg.height,
      );
    }
    return [bgImg, ovImg];
  });
}

function renderVisibleCanvasses() {
  renderImage(backgroundCtx, [backgroundImage], _angle);
  renderImage(overlayCtx, imageCanvasses, _angle);
}

function renderAllCanvasses(background: ImageBitmap | null) {
  if (background) {
    sizeVisibleCanvasses(_canvas.width, _canvas.height);
    renderImage(backgroundCtx, [background], _angle);
    renderThings(thingCtx);
    renderImage(overlayCtx, imageCanvasses, _angle);
  }
}

/**
 * Given a single point on the overlay, un-rotate and scale to the full size overlay
 */
function unrotateAndScalePoints(points: Point[]) {
  return scalePoints(unrotatePoints(_angle, _vp, _canvas, points), _zoom);
}

/**
 * Given two points on the overlay, un-rotate and scale to the full size overlay
 */
function unrotateBox(x1: number, y1: number, x2: number, y2: number) {
  const op = rotateBackToBackgroundOrientation;
  // un-rotate the zoomed out viewport. this should be precalculated.
  const [w, h] = rotatedWidthAndHeight(-_angle, _vp.width, _vp.height);
  const [ow, oh] = [_vp.width, _vp.height];
  const xOffset = _canvas.width > w ? (_canvas.width - w) / 2 : 0;
  const yOffset = _canvas.height > h ? (_canvas.height - h) / 2 : 0;

  // trim selection to viewport
  const [minY, maxY] = [yOffset, yOffset + h];
  const [minX, maxX] = [xOffset, xOffset + w];
  if (y1 < minY) y1 = minY;
  if (y2 < minY) y2 = minY;
  if (x1 < minX) x1 = minX;
  if (x2 < minX) x2 = minX;
  if (y1 > maxY) y1 = maxY;
  if (y2 > maxY) y2 = maxY;
  if (x1 > maxX) x1 = maxX;
  if (x2 > maxX) x2 = maxX;

  const p1 = scalePoints(
    [op(-_angle, x1 - xOffset, y1 - yOffset, w, h, ow, oh)],
    _zoom,
  )[0];
  const p2 = scalePoints(
    [op(-_angle, x2 - xOffset, y2 - yOffset, w, h, ow, oh)],
    _zoom,
  )[0];
  p1.x += _img.x;
  p1.y += _img.y;
  p2.x += _img.x;
  p2.y += _img.y;
  return [p1.x, p1.y, p2.x - p1.x, p2.y - p1.y];
}

function eraseBrush(x: number, y: number, radius: number) {
  // un-rotate and scale
  const p = unrotateAndScalePoints(createPoints([x, y]))[0];

  // copy image so we can clip it shortly
  const img = fullCtx.canvas.transferToImageBitmap();
  // then add the image area offset
  p.x += _img.x;
  p.y += _img.y;
  fullCtx.save();
  // fullCtx.clearRect(0, 0, fullCtx.canvas.width, fullCtx.canvas.height);
  // pay close attention here, rect is clockwise, arc is anticlockwise (last param)
  // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing#inverse_clipping_path)
  fullCtx.beginPath();
  fullCtx.rect(0, 0, fullCtx.canvas.width, fullCtx.canvas.height);
  fullCtx.arc(p.x, p.y, Math.round(radius * _zoom), 0, 2 * Math.PI, true);
  fullCtx.clip();
  fullCtx.drawImage(img, 0, 0);
  fullCtx.restore();
  img.close();
  renderImage(overlayCtx, imageCanvasses, _angle);
}

function renderToken(ctx: DrawContext, place = false) {
  if (!_token) return;
  ctx.save();
  if (place) _token.place(ctx, _zoom);
  else _token.draw(ctx);
  ctx.restore();
}

function renderBrush(x: number, y: number, radius: number, full = true) {
  if (!full) {
    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.arc(x, y, radius, 0, 2 * Math.PI);
    overlayCtx.fill();
    overlayCtx.restore();
    return;
  }
  // un-rotate and scale
  const p = unrotateAndScalePoints(createPoints([x, y]))[0];
  // then add the image area offset (eg if we're zoomed in)
  p.x += _img.x;
  p.y += _img.y;
  fullCtx.save();
  fullCtx.beginPath();
  fullCtx.arc(p.x, p.y, Math.round(radius * _zoom), 0, 2 * Math.PI);
  fullCtx.fill();
  fullCtx.restore();
  // dump to visible canvas
  renderImage(overlayCtx, imageCanvasses, _angle);
}

function renderBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: string,
  full = true,
) {
  if (!full) {
    overlayCtx.save();
    overlayCtx.fillStyle = style;
    overlayCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
    overlayCtx.restore();
    return;
  }

  const [x, y, w, h] = unrotateBox(x1, y1, x2, y2);
  fullCtx.save();
  fullCtx.fillStyle = style;
  fullCtx.fillRect(x, y, w, h);
  fullCtx.restore();
  renderImage(overlayCtx, imageCanvasses, _angle);
}

function renderThings(ctx: OffscreenCanvasRenderingContext2D) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const thing of _things) {
    try {
      ctx.save();
      thing.draw(ctx);
      ctx.restore();
    } catch (err) {
      console.error(err);
    }
  }
}

/**
 * Find the thing at a point
 * @param x the unrotated and scaled x coordinate
 * @param y the unrotated and scaled y coordinate
 * @returns the index of the thing at the given point
 */
function thingAt<T = Drawables>(
  p: Point,
  dt?: T,
  contained?: (thing: Drawable) => void,
  notContained?: (thing: Drawable) => void,
): number {
  let idx = -1;
  for (const [i, t] of _things.entries()) {
    // ensure we enforce the type restriction
    if (dt !== undefined && !isDrawableType(t, dt)) continue;

    // check the point, apply the function
    if (t.contains(p.x, p.y) && idx < 0) {
      idx = i;
      if (contained) contained(t);
    } else if (notContained) notContained(t);
  }
  return idx;
}

function clearBox(x1: number, y1: number, x2: number, y2: number) {
  overlayCtx.clearRect(x1, y1, x2 - x1, y2 - y1);
  const [x, y, w, h] = unrotateBox(x1, y1, x2, y2);
  fullCtx.clearRect(x, y, w, h);
}

function clearCanvas() {
  overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
  fullCtx.clearRect(0, 0, fullCtx.canvas.width, fullCtx.canvas.height);
}

function fullRerender(zoomOut = false) {
  /**
   * Full render is called when the image, angle or zoom changes - hence the
   * recalculation of rotated width and height, zoom, and viewports
   */
  _max_zoom = Math.max(_fullRotW / _canvas.width, _fullRotH / _canvas.height);
  _first_zoom_step = firstZoomStep(_max_zoom, _zoom_step);
  // this might get weird for rotation -- maybe it belongs in calculateCanvasses...
  if (_zoom === undefined || _zoom > _max_zoom || zoomOut) {
    _zoom = _max_zoom;
    _img.x = 0;
    _img.y = 0;
  }
  adjustZoomFromViewport();
  calculateViewport();
  renderAllCanvasses(backgroundImage);
}

/**
 * Store the updated overlay canvas buffers, update the un-rotated image, and
 * ship it to the main thread for upload unless told not to.
 *
 * @param post flag indicating if the image should be sent to the main thread
 *             for upload.
 */
const storeOverlay = () =>
  fullCtx.canvas
    .convertToBlob()
    .then((blob: Blob) => postMessage({ cmd: "overlay", blob: blob }))
    .catch((err) =>
      console.error(`Unable to post blob: ${JSON.stringify(err)}`),
    );

function animateBrush() {
  if (!recording) return;
  renderImage(overlayCtx, imageCanvasses, _angle);
  renderBrush(startX, startY, brush, false);
  requestAnimationFrame(() => animateBrush());
}

function animateToken() {
  if (!recording) return;
  if (!_token) return;
  renderImage(overlayCtx, imageCanvasses, _angle);
  renderToken(overlayCtx, true);
  requestAnimationFrame(() => animateToken());
}

function animateAllTokens() {
  if (!recording) return;
  // rerender the things
  renderThings(thingCtx);

  // rerender to the overlay (remember image canvasses includes the things canvas)
  renderImage(overlayCtx, imageCanvasses, _angle);
  requestAnimationFrame(() => animateAllTokens());
}

function animateSelection() {
  if (!recording) return;
  if (selecting) {
    renderImage(overlayCtx, imageCanvasses, _angle);
    renderBox(startX, startY, endX, endY, GUIDE_FILL, false);
  } else if (panning) {
    // calculate the (rotated) movement since the last frame and update for the next
    const [w, h] = rot(-_angle, endX - lastAnimX, endY - lastAnimY);
    [lastAnimX, lastAnimY] = [endX, endY];

    // move the panning offsets
    _img.x += Math.round((w * _max_zoom) / _zoom);
    _img.y += Math.round((h * _max_zoom) / _zoom);

    // ensure panning offsets are within image boundaries
    trimPanning();

    renderVisibleCanvasses();
  }
  requestAnimationFrame(animateSelection);
}

function adjustZoom(zoom: number, x: number, y: number) {
  const [cW, cH] = rotatedWidthAndHeight(_angle, _canvas.width, _canvas.height);
  const p = unrotatePoints(_angle, _vp, _canvas, createPoints([x, y]))[0];
  const q = scalePoints([p], _zoom)[0];
  q.x += _img.x;
  q.y += _img.y;
  _zoom = zoom;
  calculateViewport();
  // calculate any offsets for where we are completely zoomed in in one dimension
  // note that we accommodate for the rotation
  const yOffset = _vp.height < cH ? cH - _vp.height : 0;
  const xOffset = _vp.width < cW ? cW - _vp.width : 0;
  // calculate point relative to new viewport
  const newX = p.x - xOffset;
  const newY = p.y - yOffset;
  _img.x = q.x - _zoom * newX;
  _img.y = q.y - _zoom * newY;
  trimPanning();
  renderAllCanvasses(backgroundImage);
}

async function updateThings(
  apiUrl: string,
  bearer: string,
  things?: unknown[],
  render = false,
) {
  // clear the existing thing list
  _things.length = 0;

  // cheese it if there are no things to render
  if (!things) return;

  const promises: Promise<Drawable>[] = [];
  for (const thing of things.filter((thing) => thing)) {
    promises.push(createDrawable(thing, bearer));
  }
  let drawables: Drawable[];
  try {
    drawables = await Promise.all(promises);
  } catch (err) {
    console.error(`Unable to load things: ${JSON.stringify(err)}`);
    if ("stack" in (err as Error)) {
      console.error((err as Error).stack);
    }
    return;
  }
  drawables.forEach((d) => _things.push(d));

  // render if we're asked (avoided in cases of subsequent full renders)
  if (!render) return;
  renderThings(thingCtx);
  renderImage(overlayCtx, imageCanvasses, _angle);
}

async function update(values: TableUpdate) {
  const { apiUrl, bearer, angle, background, viewport, things } = values;
  if (!background) {
    if (things) return updateThings(apiUrl, bearer, things, true);
    console.error(`Ignoring update without background`);
    return;
  }
  _angle = angle;
  updateThings(apiUrl, bearer, things);

  if (viewport) {
    copyRect(viewport, _img_orig);
  }

  try {
    const [bgImg, ovImg] = await loadAllImages(values);
    if (!bgImg) return;

    const thingCanvas = new OffscreenCanvas(bgImg.width, bgImg.height);
    thingCtx = thingCanvas.getContext("2d", {
      alpha: true,
    }) as OffscreenCanvasRenderingContext2D;

    const fullCanvas = new OffscreenCanvas(bgImg.width, bgImg.height);
    fullCtx = fullCanvas.getContext("2d", {
      alpha: true,
    }) as OffscreenCanvasRenderingContext2D;

    // set the image rendering order (in reverse, things on top => things draw last)
    imageCanvasses = _things_on_top_of_overlay
      ? [fullCtx.canvas, thingCtx.canvas]
      : [thingCtx.canvas, fullCtx.canvas];

    if (ovImg) {
      fullCtx.drawImage(ovImg, 0, 0);
      ovImg.close();
    } else {
      clearCanvas();
    }
    fullRerender(!viewport);
  } catch (err) {
    console.error(`Unable to load images on update: ${JSON.stringify(err)}`);
  }
}

self.onmessage = async (evt) => {
  console.log(evt.data.cmd);
  switch (evt.data.cmd) {
    case "init": {
      // ensure the background canvas is valid
      const bgCanvas = evt.data.background;
      if (!bgCanvas) {
        console.error(
          `ERROR: PORK CHOP SANDWHICHES - no background canvas in contentworker init`,
        );
        return;
      }

      const ovCanvas = evt.data.overlay;
      if (!ovCanvas) {
        console.error(
          `ERROR: PORK CHOP SANDWICHES - no overlay canvas in contentworker init`,
        );
        return;
      }

      _canvas.width = bgCanvas.width;
      _canvas.height = bgCanvas.height;

      backgroundCtx = bgCanvas.getContext("2d", {
        alpha: false,
      }) as OffscreenCanvasRenderingContext2D;

      overlayCtx = evt.data.overlay.getContext("2d", {
        alpha: true,
      }) as OffscreenCanvasRenderingContext2D;

      // indicate if things should be rendered on top of the overlay
      _things_on_top_of_overlay = !!evt.data.thingsOnTop;
      break;
    }
    case "update": {
      try {
        // TODO micah maybe check (or return from update) if there was actually a resize!?!?!?
        await update(evt.data.values);

        postMessage({ cmd: "updated" });

        // technically, because the background changed, we've resized due to the image changing size
        postMessage({
          cmd: "resized",
          width: _vp.width,
          height: _vp.height,
          fullWidth: backgroundImage.width,
          fullHeight: backgroundImage.height,
        });
      } catch (err) {
        console.error(`Unable to update: ${JSON.stringify(err)}`);
      }
      break;
    }
    case "things": {
      // refactor update to handle things on their own
      await update(evt.data.values);
      break;
    }
    case "resize": {
      _canvas.width = evt.data.width;
      _canvas.height = evt.data.height;
      if (backgroundImage) {
        adjustZoomFromViewport();
        calculateViewport();
        trimPanning();
        fullRerender();
        postMessage({
          cmd: "resized",
          width: _vp.width,
          height: _vp.height,
          fullWidth: backgroundImage.width,
          fullHeight: backgroundImage.height,
        });
      }
      break;
    }
    case "rotate": {
      /**
       * Set the angle then render all canvasses. Keep in mind we are using
       * UN-ROTATED images as our starting point and rotating to the request
       * angle. If you start trying to use the actual canvas data, which might
       * already be rotated, you end up over-rotating and things get really bad.
       */
      _angle = evt.data.angle;
      fullRerender();
      break;
    }
    case "erase": {
      startX = evt.data.x;
      startY = evt.data.y;
      if (evt.data.buttons === 0) {
        // here we don't draw BUT if you look at animateBrush, you'll see that we'll just repaint the
        // overlay and then render the translucent brush
        if (!recording) {
          overlayCtx.fillStyle = GUIDE_FILL;
          recording = true;
          requestAnimationFrame(animateBrush);
        }
      } else if (evt.data.buttons === 1) {
        /* nop */
        recording = false;
        eraseBrush(evt.data.x, evt.data.y, brush);
      }
      break;
    }
    case "paint": {
      startX = evt.data.x;
      startY = evt.data.y;
      // here we do not turn recording on or off (thats handled by the move/record/end events elsewhere)
      // also "recording" is not "painting" TODO MICAH COME BACK HERE AND CONFIRM ITS ABOUT CANVAS ANIMATION
      // where we do not paint (painting is separate from drawing the selection or the translucent brush)
      if (evt.data.buttons === 0) {
        // here we don't draw BUT if you look at animateBrush, you'll see that we'll just repaint the
        // overlay and then render the translucent brush
        if (!recording) {
          overlayCtx.fillStyle = GUIDE_FILL;
          recording = true;
          requestAnimationFrame(animateBrush);
        }
      } else if (evt.data.buttons === 1) {
        // here however we just update the canvas with the actual brush. It seems that the fill call
        // in renderBrush will force the canvas to update so there isn't much point in using animation
        // frames
        if (recording) {
          recording = false;
          overlayCtx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${opacity})`;
          fullCtx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${opacity})`;
        }
        renderBrush(evt.data.x, evt.data.y, brush);
      }
      break;
    }
    case "token": {
      // tokens behave differently than brushes - brushes "record" the mouse movement when no button
      // is pressed and then paint directly to the canvases when it is. Tokens just record until the
      // the mouse button is pressed and then released. The token is then placed at the last mouse
      // position where by the end_token command.
      if (!_token) break;
      _token.token.x = evt.data.x;
      _token.token.y = evt.data.y;

      if (!recording) {
        recording = true;
        requestAnimationFrame(animateToken);
      }
      break;
    }
    case "set_token": {
      if (!("token" in evt.data) || !("bearer" in evt.data)) break;
      _token = (await createDrawable(
        evt.data.token,
        evt.data.bearer,
      )) as DrawableToken;
      break;
    }
    case "delete_token": {
      if (!recording) {
        recording = true;
        requestAnimationFrame(animateAllTokens);
      }

      const { x, y } = evt.data;
      [startX, startY] = [x, y];
      const p = unrotateAndScalePoints(createPoints([x, y]))[0];
      thingAt(
        p,
        DrawableToken,
        (thing) => thing.setOpacity(0.5),
        (thing) => thing.setOpacity(1),
      );
      break;
    }
    case "move":
    case "select":
    case "record": {
      endX = evt.data.x;
      endY = evt.data.y;
      if (!recording) {
        selecting = evt.data.cmd === "select";
        panning = evt.data.cmd === "move";
        recording = (selecting && evt.data.buttons === 1) || panning;
        if (recording) {
          lastAnimX = evt.data.x;
          lastAnimY = evt.data.y;
          startX = evt.data.x;
          startY = evt.data.y;
        }
        requestAnimationFrame(animateSelection);
      }
      break;
    }
    case "wait":
    case "end_move": {
      panning = false;
      recording = false;
      lastAnimX = -1;
      lastAnimY = -1;
      startX = -1;
      startY = -1;
      endX = -1;
      endY = -1;
      // restore the clean (no opaque brush indicator/token indicator where the mouse was) overlay
      renderImage(overlayCtx, imageCanvasses, _angle);
      break;
    }
    case "end_erase": {
      recording = false;
      panning = false;
      renderImage(overlayCtx, imageCanvasses, _angle);
      storeOverlay();
      break;
    }
    case "end_paint": {
      recording = false;
      panning = false;
      brush = MIN_BRUSH;
      storeOverlay();
      renderImage(overlayCtx, imageCanvasses, _angle);
      break;
    }
    case "end_select": {
      if (panning) {
        postMessage({ cmd: "pan_complete" });
      } else {
        postMessage({
          cmd: "select_complete",
          rect: rectFromPoints(createPoints([startX, startY, endX, endY])),
        });
      }
      // when we're done recording we're done panning BUT not selecting
      // we still have a selection on screen. Selection ends at the start
      // of the next mouse recording
      recording = false;
      panning = false;
      // reset last animation coordinates
      lastAnimX = -1;
      lastAnimY = -1;
      startX = -1;
      startY = -1;
      endX = -1;
      endY = -1;
      break;
    }
    case "end_token": {
      /**
       * end_token is triggered on "complete" from the statemachine which is triggered
       * by the mouse up event. startX and startY will be the last mouse position while
       * the mouse was down. This is the position where the token will be placed.
       */
      if (!_token) {
        // TODO report this error to the main thread
        console.error(`ERROR: no token set in end_token`);
        return;
      }

      const p = unrotateAndScalePoints(
        createPoints([_token.token.x, _token.token.y]),
      )[0];
      _token.token.x = Math.round(p.x + _img.x);
      _token.token.y = Math.round(p.y + _img.y);
      _token.token.angle -= _angle;
      _token.normalize();

      // copy {... }is important otherwise, future mouse move impacts the drawable
      const t = await createDrawable({ ..._token.token }, "");

      recording = false;
      panning = false;
      renderToken(thingCtx);
      _things.push(t);
      postMessage({ cmd: "token_placed", instance: _token.token });

      _token.token.angle += _angle;
      _token.normalize();
      break;
    }
    case "end_delete_token": {
      recording = false;
      const p = unrotateAndScalePoints(createPoints([startX, startY]))[0];
      const idx = thingAt(p, DrawableToken);
      if (idx < 0) return;
      const t = _things.splice(idx, 1)[0] as DrawableToken;
      postMessage({ cmd: "token_deleted", instance: t.token });
      break;
    }
    case "obscure": {
      const fill = `rgba(${red}, ${green}, ${blue}, ${opacity})`;
      const r = evt.data.rect as unknown as Rect;
      renderBox(r.x, r.y, r.x + r.width, r.y + r.height, fill);
      storeOverlay();
      break;
    }
    case "reveal": {
      const r = evt.data.rect as unknown as Rect;
      clearBox(r.x, r.y, r.x + r.width, r.y + r.height);
      storeOverlay();
      break;
    }
    case "clear": {
      clearCanvas();
      storeOverlay();
      break;
    }
    case "opacity": {
      opacity = evt.data.opacity;
      break;
    }
    case "colour": {
      red = evt.data.red;
      green = evt.data.green;
      blue = evt.data.blue;
      break;
    }
    case "zoom": {
      /**
       * TODO this shouldn't be called zoom -- instead we should have a generic
       * "get the un-rotated rectangle projected on the full sized image that has
       * been selected" call.  Maybe selection
       *
       * TODO call this "selection"
       */
      // get the scaled down viewport
      const fullVp = normalizeRect(
        rectFromPoints(
          translatePoints(
            unrotateAndScalePoints(pointsFromRect(evt.data.rect)),
            _img.x,
            _img.y,
          ),
        ),
      );

      // post back the full viewport
      postMessage({ cmd: "viewport", viewport: fullVp });
      break;
    }
    case "zoom_in": {
      let zoom = _zoom;
      if (!_zoom) zoom = _max_zoom;
      else if (_zoom === _max_zoom) zoom = _first_zoom_step;
      else if (_zoom > _zoom_step) zoom -= _zoom_step;
      if (zoom !== _zoom) adjustZoom(zoom, evt.data.x, evt.data.y);
      break;
    }
    case "zoom_out": {
      let zoom = _zoom;
      if (zoom === _max_zoom) return;
      if (zoom === _first_zoom_step) zoom = _max_zoom;
      else zoom += _zoom_step;
      if (zoom >= _max_zoom) zoom = _max_zoom; // after a resize this can happen
      if (zoom !== _zoom) adjustZoom(zoom, evt.data.x, evt.data.y);
      break;
    }
    case "brush_inc": {
      // eventually you will return to this - it may be a good idea to consider
      // creating separate events if its not too much overhead in the editor.
      //
      // this caused a https://github.com/micahg/tbltp/issues/319 because `vamp`
      // was undefined when calculateToken tried to access its properties.

      if (evt.data.action === "token" && _token) {
        if (_token.token.scale < 1) _token.token.scale *= 2;
        else _token.token.scale += 0.5;
      } else {
        brush += MIN_BRUSH;
      }
      break;
    }
    case "brush_dec": {
      if (evt.data.action === "token" && _token) {
        if (_token.token.scale < 1) _token.token.scale *= 0.5;
        else _token.token.scale -= 0.5;
      } else {
        brush -= brush > MIN_BRUSH ? MIN_BRUSH : 0;
      }
      break;
    }
    case "brush_rot": {
      if (evt.data.action !== "token" || !_token) return;
      const coef = evt.data.delta > 0 ? 1 : -1;
      _token.token.angle += coef * 15;
      _token.normalize();
      console.log(`rotating token to ${_token.token.angle}`);
      break;
    }
    default: {
      console.error(`Unexpected worker command: ${evt.data.cmd}`);
      break;
    }
  }
};

export {};
