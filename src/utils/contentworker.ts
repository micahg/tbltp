import {
  Rect,
  getMaxContainerSize,
  getScaledContainerSize,
  rotateBackToBackgroundOrientation,
  rotatedWidthAndHeight,
} from "./geometry";

interface ScaledDimensions {
  width: number;
  height: number;
  rotatedWidth: number;
  rotatedHeight: number;
}

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
let buff: ImageData;
let fullBuff: ImageData;
let _angle: number;
let _screenW: number;
let _screenH: number;
let _scaleW: number;
let _scaleH: number;
let _scaleOriginW: number;
let _scaleOriginH: number;

let startX: number, startY: number, endX: number, endY: number;
let scale: number;

let opacity = "1";
let red = "255";
let green = "0";
let blue = "0";

function renderImage(
  ctx: OffscreenCanvasRenderingContext2D,
  img: ImageBitmap,
  angle: number,
  dimensions: ScaledDimensions,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(dimensions.rotatedWidth / 2, dimensions.rotatedHeight / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(
    img,
    0,
    0,
    img.width,
    img.height,
    -dimensions.width / 2,
    -dimensions.height / 2,
    dimensions.width,
    dimensions.height,
  );
  ctx.restore();
}

function loadImage(url: string): Promise<ImageBitmap> {
  return fetch(url)
    .then((resp) => resp.blob())
    .then((blob) => createImageBitmap(blob));
}

/**
 * Resize all canvasses based on the angle of background image rotation, screen
 * size, and image width and height.
 *
 * TODO: This is leaning on global variables. It should not.
 *
 * @param angle
 * @param width
 * @param height
 * @returns
 */
function sizeAllCanvasses(
  angle: number,
  width: number,
  height: number,
): ScaledDimensions[] {
  // just establish the biggest box we can render to considering our screen and ui components
  const [contW, contH] = getMaxContainerSize(_screenW, _screenH);

  //rotatedWidthAndHeight
  // rotate the full sized hidden canvas (holds the full-sized overlay)
  const [fullRotW, fullRotH] = rotatedWidthAndHeight(angle, width, height);

  // scale the rotated full size image down be contained within our container bounds
  const [scaleContW, scaleContH] = getScaledContainerSize(
    contW,
    contH,
    fullRotW,
    fullRotH,
  );

  // rotate backwards to get the original height/width scaled down (we need it to drawImage)
  const [scaleW, scaleH] = rotatedWidthAndHeight(
    -angle,
    scaleContW,
    scaleContH,
  );

  // calculate pre-rotation scale
  scale = width / scaleW;

  // set the canvases
  backgroundCanvas.width = scaleContW;
  backgroundCanvas.height = scaleContH;
  overlayCanvas.width = scaleContW;
  overlayCanvas.height = scaleContH;
  // we actually un-rotate all updates...  this might become problematic with free-drawing
  fullOverlayCanvas.width = width;
  fullOverlayCanvas.height = height;

  const d = {
    width: scaleW,
    height: scaleH,
    rotatedWidth: scaleContW,
    rotatedHeight: scaleContH,
  };
  const fullD = {
    width: width,
    height: height,
    rotatedWidth: width,
    rotatedHeight: height,
  };

  return [d, fullD];
}

function loadAllImages(background: string, overlay?: string) {
  const bgP = loadImage(background);
  const ovP = overlay ? loadImage(overlay) : Promise.resolve(null);
  return Promise.all([bgP, ovP]).then(([bgImg, ovImg]) => {
    // keep a copy of these to prevent having to recreate them from the image buffer
    backgroundImage = bgImg;
    if (ovImg) overlayImage = ovImg;
    return [bgImg, ovImg];
  });
}

function renderAllCanvasses(
  background: ImageBitmap | null,
  overlay: ImageBitmap | null,
) {
  if (background) {
    const [dimensions, fullDimensions] = sizeAllCanvasses(
      _angle,
      background.width,
      background.height,
    );
    _scaleOriginW = dimensions.width;
    _scaleOriginH = dimensions.height;
    _scaleW = dimensions.rotatedWidth;
    _scaleH = dimensions.rotatedHeight;
    renderImage(backgroundCtx, background, _angle, dimensions);
    if (overlay) {
      renderImage(overlayCtx, overlay, _angle, dimensions);
      buff = overlayCtx.getImageData(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height,
      );
      renderImage(fullCtx, overlay, 0, fullDimensions);
      fullBuff = fullCtx.getImageData(
        0,
        0,
        fullCtx.canvas.width,
        fullCtx.canvas.height,
      );
    }
  }
}

function unrotateAndScaleRect(rect: Rect): Rect {
  const [rx1, ry1] = rotateBackToBackgroundOrientation(
    -_angle,
    rect.x,
    rect.y,
    _scaleW,
    _scaleH,
    _scaleOriginW,
    _scaleOriginH,
  );
  const [rx2, ry2] = rotateBackToBackgroundOrientation(
    -_angle,
    rect.x + rect.width,
    rect.y + rect.height,
    _scaleW,
    _scaleH,
    _scaleOriginW,
    _scaleOriginH,
  );
  // this isn't necessary but just keep values positive
  const x1 = Math.min(rx1, rx2);
  const x2 = Math.max(rx1, rx2);
  const y1 = Math.min(ry1, ry2);
  const y2 = Math.max(ry1, ry2);
  return {
    x: Math.round(scale * x1),
    y: Math.round(scale * y1),
    width: Math.round(scale * (x2 - x1)),
    height: Math.round(scale * (y2 - y1)),
  };
}

/**
 * Given to points on the overlay, un-rotate and scale to the full size overlay
 */
function unrotateBox(x1: number, y1: number, x2: number, y2: number) {
  const [rx1, ry1] = rotateBackToBackgroundOrientation(
    -_angle,
    x1,
    y1,
    _scaleW,
    _scaleH,
    _scaleOriginW,
    _scaleOriginH,
  );
  const [rx2, ry2] = rotateBackToBackgroundOrientation(
    -_angle,
    x2,
    y2,
    _scaleW,
    _scaleH,
    _scaleOriginW,
    _scaleOriginH,
  );
  const [rw, rh] = [rx2 - rx1, ry2 - ry1];
  return [scale * rx1, scale * ry1, scale * rw, scale * rh];
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

/**
 * Store the updated overlay canvas buffers, update the un-rotated image, and
 * ship it to the main thread for upload.
 */
function storeOverlay() {
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
  restoreOverlay();
  renderBox(startX, startY, endX, endY, "rgba(255, 255, 255, 0.25)", false);
  requestAnimationFrame(animateSelection);
}

// eslint-disable-next-line no-restricted-globals
self.onmessage = (evt) => {
  switch (evt.data.cmd) {
    case "init": {
      console.log(evt.data);
      _screenW = evt.data.values.screenWidth;
      _screenH = evt.data.values.screenHeight;
      // TODO get the angle from the viewport on load
      _angle = evt.data.values.angle;

      if (evt.data.background) {
        backgroundCanvas = evt.data.background;
        backgroundCtx = backgroundCanvas.getContext("2d", {
          alpha: true,
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

      loadAllImages(evt.data.values.background, evt.data.values.overlay)
        .then(([bgImg, ovImg]) => {
          if (bgImg) backgroundImage = bgImg;
          renderAllCanvasses(bgImg, ovImg);
        })
        .then(() => {
          postMessage({
            cmd: "initialized",
            width: _scaleW,
            height: _scaleH,
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
    case "rotate": {
      /**
       * Set the angle then render all canvasses. Keep in mind we are using
       * UN-ROTATED images as our starting point and rotating to the request
       * angle. If you start trying to use the actual canvas data, which might
       * already be rotated, you end up over-rotating and things get really bad.
       */
      _angle = evt.data.angle;
      renderAllCanvasses(backgroundImage, overlayImage);
      break;
    }
    case "record": {
      startX = evt.data.x1;
      startY = evt.data.y1;
      endX = evt.data.x2;
      endY = evt.data.y2;
      if (!recording) {
        recording = true;
        restoreOverlay();
        requestAnimationFrame(animateSelection);
      }
      break;
    }
    case "endrecording": {
      recording = false;
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
      // get the scaled down viewport
      const vp: Rect = evt.data.rect;
      // project onto un-rotated full size origin
      const fullVp = unrotateAndScaleRect(vp);
      // post back the full viewport
      postMessage({ cmd: "viewport", viewport: fullVp });
      // clear selection
      restoreOverlay();
      break;
    }
    default: {
      console.error(`Unexpected worker command: ${evt.data.cmd}`);
      break;
    }
  }
};

export {};
