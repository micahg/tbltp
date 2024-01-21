import { LoadProgress, loadImage } from "./content";
import {
  Point,
  Rect,
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
} from "./geometry";

/**
 * Worker for offscreen drawing in the content editor.
 */
let backgroundImage: ImageBitmap;
let overlayImage: ImageBitmap;
let backgroundCanvas: OffscreenCanvas;
let backgroundCtx: OffscreenCanvasRenderingContext2D;
let overlayCanvas: OffscreenCanvas;
let overlayCtx: OffscreenCanvasRenderingContext2D;
let fullOverlayCanvas: OffscreenCanvas;
let fullCtx: OffscreenCanvasRenderingContext2D;
let recording = false;
let selecting = false;
let panning = false;
let buff: ImageData;
let fullBuff: ImageData;
let _angle: number;
let _zoom: number;
const _zoom_step = 0.5;
let _max_zoom: number;
let _first_zoom_step: number;

// canvas width and height (sent from main thread)
const _canvas: Rect = { x: 0, y: 0, width: 0, height: 0 };

// region of images to display
const _img: Rect = { x: 0, y: 0, width: 0, height: 0 };

// viewport
const _vp: Rect = { x: 0, y: 0, width: 0, height: 0 };

// rotated image width and height - cached to avoid recalculation after load
let _fullRotW: number;
let _fullRotH: number;

let startX: number, startY: number, endX: number, endY: number;
let lastAnimX = -1;
let lastAnimY = -1;

let opacity = "1";
let red = "255";
let green = "0";
let blue = "0";

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
  img: ImageBitmap,
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
  ctx.drawImage(
    img,
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
  ctx.restore();
}

function calculateViewport(
  angle: number,
  zoom: number,
  containerWidth: number,
  containerHeight: number,
) {
  const [cw, ch] = [containerWidth, containerHeight];
  [_vp.width, _vp.height] = rotatedWidthAndHeight(-angle, cw, ch);
  [_img.width, _img.height] = [zoom * _vp.width, zoom * _vp.height];
  if (_img.width > backgroundImage.width) {
    _img.width = backgroundImage.width;
    _vp.width = Math.round((_vp.height * _img.width) / _img.height);
  } else if (_img.height > backgroundImage.height) {
    _img.height = backgroundImage.height;
    _vp.height = Math.round((_vp.width * _img.height) / _img.width);
  }
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
  backgroundCanvas.width = width;
  backgroundCanvas.height = height;
  overlayCanvas.width = width;
  overlayCanvas.height = height;
}

function loadAllImages(bearer: string, background: string, overlay?: string) {
  const progress = (p: LoadProgress) =>
    postMessage({ cmd: "progress", evt: p });
  const bgP = loadImage(background, bearer, progress);
  const ovP = overlay
    ? loadImage(overlay, bearer, progress)
    : Promise.resolve(null);
  // TODO signal an error if either promise fails
  return Promise.all([bgP, ovP]).then(([bgImg, ovImg]) => {
    // keep a copy of these to prevent having to recreate them from the image buffer
    backgroundImage = bgImg;
    if (ovImg) overlayImage = ovImg;
    else {
      clearCanvas();
      storeOverlay(false);
    }
    return [bgImg, ovImg];
  });
}

function renderVisibleCanvasses() {
  renderImage(backgroundCtx, backgroundImage, _angle);
  renderImage(overlayCtx, overlayImage, _angle);
}

function renderAllCanvasses(
  background: ImageBitmap | null,
  overlay: ImageBitmap | null,
) {
  if (background) {
    sizeVisibleCanvasses(_canvas.width, _canvas.height);
    renderImage(backgroundCtx, background, _angle);
    if (overlay) {
      renderImage(overlayCtx, overlay, _angle);
      buff = overlayCtx.getImageData(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height,
      );
      // sync full overlay to background size and draw un-scaled/un-rotated image
      fullOverlayCanvas.width = background.width;
      fullOverlayCanvas.height = background.height;
      fullCtx.drawImage(overlay, 0, 0);
      fullBuff = fullCtx.getImageData(0, 0, overlay.width, overlay.height);
    }
  }
}

/**
 * Given a single point on the overlay, un-rotate and scale to the full size overlay
 */
function unrotateAndScalePoints(points: Point[]) {
  return scalePoints(unrotatePoints(_angle, _vp, _canvas, points), _zoom);
}

/**
 * Given to points on the overlay, un-rotate and scale to the full size overlay
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

function renderBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: string,
  full = true,
) {
  overlayCtx.save();
  overlayCtx.fillStyle = style;
  overlayCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
  overlayCtx.restore();
  if (full) {
    const [x, y, w, h] = unrotateBox(x1, y1, x2, y2);
    fullCtx.save();
    fullCtx.fillStyle = style;
    fullCtx.fillRect(x, y, w, h);
    fullCtx.restore();
  }
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

function restoreOverlay() {
  overlayCtx.putImageData(buff, 0, 0);
  fullCtx.putImageData(fullBuff, 0, 0);
}

function fullRerender(zoomOut = false) {
  /**
   * Full render is called when the image, angle or zoom changes - hence the
   * recalculation of rotated width and height, zoom, and viewports
   */
  [_fullRotW, _fullRotH] = rotatedWidthAndHeight(
    _angle,
    backgroundImage.width,
    backgroundImage.height,
  );
  _max_zoom = Math.max(_fullRotW / _canvas.width, _fullRotH / _canvas.height);
  _first_zoom_step = firstZoomStep(_max_zoom, _zoom_step);
  // this might get weird for rotation -- maybe it belongs in calculateCanvasses...
  if (_zoom === undefined || _zoom > _max_zoom || zoomOut) {
    _zoom = _max_zoom;
    _img.x = 0;
    _img.y = 0;
  }
  calculateViewport(_angle, _zoom, _canvas.width, _canvas.height);
  renderAllCanvasses(backgroundImage, overlayImage);
}

/**
 * Store the updated overlay canvas buffers, update the un-rotated image, and
 * ship it to the main thread for upload unless told not to.
 *
 * @param post flag indicating if the image should be sent to the main thread
 *             for upload.
 */
function storeOverlay(post = true) {
  fullBuff = fullCtx.getImageData(
    0,
    0,
    fullCtx.canvas.width,
    fullCtx.canvas.height,
  );
  buff = overlayCtx.getImageData(
    0,
    0,
    overlayCtx.canvas.width,
    overlayCtx.canvas.height,
  );
  if (post)
    fullOverlayCanvas
      .convertToBlob()
      .then((blob: Blob) => postMessage({ cmd: "overlay", blob: blob }))
      .catch((err) =>
        console.error(`Unable to post blob: ${JSON.stringify(err)}`),
      );
  overlayImage = fullOverlayCanvas.transferToImageBitmap();
}

function animateSelection() {
  if (!recording) return;
  if (selecting) {
    restoreOverlay();
    renderBox(startX, startY, endX, endY, "rgba(255, 255, 255, 0.25)", false);
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
  calculateViewport(_angle, _zoom, _canvas.width, _canvas.height);
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
  renderAllCanvasses(backgroundImage, overlayImage);
}
// eslint-disable-next-line no-restricted-globals
self.onmessage = (evt) => {
  switch (evt.data.cmd) {
    case "init": {
      _angle = evt.data.values.angle;
      // _bearer = evt.data.values.bearer;

      if (evt.data.background) {
        backgroundCanvas = evt.data.background;
        _canvas.width = Math.round(backgroundCanvas.width);
        _canvas.height = Math.round(backgroundCanvas.height);
        backgroundCtx = backgroundCanvas.getContext("2d", {
          alpha: false,
        }) as OffscreenCanvasRenderingContext2D;
      }

      if (evt.data.overlay) {
        overlayCanvas = evt.data.overlay;
        overlayCtx = overlayCanvas.getContext("2d", {
          alpha: true,
        }) as OffscreenCanvasRenderingContext2D;
      }

      if (evt.data.fullOverlay) {
        fullOverlayCanvas = evt.data.fullOverlay;
        fullCtx = fullOverlayCanvas.getContext("2d", {
          alpha: true,
        }) as OffscreenCanvasRenderingContext2D;
      }

      loadAllImages(
        evt.data.values.bearer,
        evt.data.values.background,
        evt.data.values.overlay,
      )
        .then(([bgImg]) => {
          if (bgImg) {
            calculateViewport(_angle, _zoom, _canvas.width, _canvas.height);
            trimPanning();
            fullRerender(true);
          }
        })
        .then(() => {
          postMessage({
            cmd: "initialized",
            width: _vp.width,
            height: _vp.height,
            fullWidth: backgroundImage.width,
            fullHeight: backgroundImage.height,
          });
          buff = overlayCtx.getImageData(
            0,
            0,
            overlayCtx.canvas.width,
            overlayCtx.canvas.height,
          );
          fullBuff = fullCtx.getImageData(
            0,
            0,
            fullCtx.canvas.width,
            fullCtx.canvas.height,
          );
        })
        .catch((err) => {
          console.error(
            `Unable to load image ${evt.data.url}: ${JSON.stringify(err)}`,
          );
        });
      break;
    }
    case "resize": {
      _canvas.width = evt.data.width;
      _canvas.height = evt.data.height;
      if (backgroundImage) {
        calculateViewport(_angle, _zoom, _canvas.width, _canvas.height);
        trimPanning();
        fullRerender();
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
    case "start_recording": {
      restoreOverlay();
      selecting = false;
      break;
    }
    case "record": {
      if (lastAnimX < 0) {
        // less than 0 indicates a new recording so initialize the last
        // animation x and y coordinates
        lastAnimX = evt.data.x1;
        lastAnimY = evt.data.y1;
      }
      startX = evt.data.x1;
      startY = evt.data.y1;
      endX = evt.data.x2;
      endY = evt.data.y2;
      if (!recording) {
        recording = true;
        selecting = evt.data.buttons === 1;
        panning = evt.data.buttons === 2;
        requestAnimationFrame(animateSelection);
      }
      break;
    }
    case "endrecording": {
      if (panning) {
        storeOverlay(false);
        postMessage({ cmd: "pan_complete" });
      }
      // when we're done recording we're done panning BUT not selecting
      // we still have a selection on screen. Selection ends at the start
      // of the next mouse recording
      recording = false;
      panning = false;
      // reset last animation coordinates
      lastAnimX = -1;
      lastAnimY = -1;
      break;
    }
    case "obscure": {
      restoreOverlay();
      const fill = `rgba(${red}, ${green}, ${blue}, ${opacity})`;
      renderBox(startX, startY, endX, endY, fill);
      storeOverlay();
      break;
    }
    case "reveal": {
      restoreOverlay();
      clearBox(startX, startY, endX, endY);
      storeOverlay();
      break;
    }
    case "clear": {
      clearCanvas();
      storeOverlay();
      break;
    }
    case "clearselection": {
      restoreOverlay();
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
      // clear selection
      restoreOverlay();
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
    default: {
      console.error(`Unexpected worker command: ${evt.data.cmd}`);
      break;
    }
  }
};

export {};
