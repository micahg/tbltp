import { Rect } from "@micahg/tbltp-common";

export interface Point {
  x: number;
  y: number;
}

export interface ImageBound {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: boolean;
}

export function createPoints(values: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < values.length; i += 2) {
    const p = { x: values[i], y: values[i + 1] };
    points.push(p);
  }
  return points;
}

export function createRect(values: number[]): Rect {
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

export function pointsFromRect(rect: Rect): Point[] {
  const p1: Point = { x: rect.x, y: rect.y };
  const p2: Point = { x: p1.x + rect.width, y: p1.y + rect.height };
  return [p1, p2];
}

export function rectFromPoints(points: Point[]): Rect {
  return {
    x: points[0].x,
    y: points[0].y,
    width: points[1].x - points[0].x,
    height: points[1].y - points[0].y,
  };
}

export function calculateBounds(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
) {
  const cr = canvasWidth / canvasHeight;
  const ir = imageWidth / imageHeight;
  if (cr > ir) {
    // canvas aspect wider than image aspect
    const w = Math.round(canvasHeight * ir);
    const l = Math.round((canvasWidth - w) / 2);
    return { x: l, y: 0, width: w, height: canvasHeight };
  }
  const h = Math.round(canvasWidth / ir);
  const t = Math.round((canvasHeight - h) / 2);
  return { x: 0, y: t, width: canvasWidth, height: h };
}

/**
 * Determine the first step of zooming.
 *
 * Example: if the maxZoom is 2.9 and the step is 0.5 (assuming 1 is a 1:1
 * pixel view and 2.9 would fit the entire width of the image), this should
 * return 2.5 so we can descend in clean intervals.
 */
export function firstZoomStep(maxZoom: number, step: number): number {
  let magnitude = 0;
  let multStep = step;
  while (multStep < 1) {
    multStep *= 10;
    magnitude++;
  }
  const scaleScale = Math.pow(10, magnitude);
  const scaledFactor = step * scaleScale;
  return (
    (Math.floor(Math.floor(maxZoom * scaleScale) / scaledFactor) *
      scaledFactor) /
    scaleScale
  );
}

/**
 * Rotate a point around the origin
 * @param angle angle of rotation
 * @param x x coordinate
 * @param y y coordinate
 * @returns the rotated point as an array of two numbers [x,y]
 */
export function rot(angle: number, x: number, y: number) {
  const r = Math.PI * (angle / 180);
  const mcos = Math.round(Math.cos(r));
  const msin = Math.round(Math.sin(r));
  const xp = x * mcos - y * msin;
  const yp = x * msin + y * mcos;
  return [xp, yp];
}

/**
 * Rotate a point back to the orientation of the background. This is used in
 * situations where drawing is occurring on an already rotated image.
 */
export function rotateBackToBackgroundOrientation(
  angle: number,
  x: number,
  y: number,
  w: number,
  h: number,
  ow: number,
  oh: number,
): Point {
  /**
   * This is a modified rotation algorithm that does its final transposition
   * after rotation assuming that instead of returning to the starting point,
   * you are returning to the origin of your un-rotated image based on its
   * un-rotated width and height.
   */
  const d_x = x - w / 2;
  const d_y = y - h / 2;
  const [r_x, r_y] = rot(angle, d_x, d_y);
  const o_x = ow / 2;
  const o_y = oh / 2;
  return { x: r_x + o_x, y: r_y + o_y };
}

export function normalizeRect(r: Rect) {
  if (r.width < 0) {
    r.width = Math.abs(r.width);
    r.x -= r.width;
  }
  if (r.height < 0) {
    r.height = Math.abs(r.height);
    r.y -= r.height;
  }

  return r;
}

/**
 * If you were to rotate a rectangle around its own center, get the width and
 * heigh it would occupy.
 * @param angle angle of rotation
 * @param width rectangle width
 * @param height rectangle heigh
 * @returns an array
 */
export function rotatedWidthAndHeight(
  angle: number,
  width: number,
  height: number,
) {
  //https://stackoverflow.com/questions/69963451/how-to-get-height-and-width-of-element-when-it-is-rotated/69966021#69966021
  const r = Math.PI * (angle / 180);
  const cos = Math.round(Math.cos(r));
  const sin = Math.round(Math.sin(r));
  const h = Math.abs(width * sin + height * cos);
  const w = Math.abs(height * sin + width * cos);
  return [w, h];
}

export function unrotatePoints(
  angle: number,
  vp: Rect,
  canvas: Rect,
  points: Point[],
): Point[] {
  const op = rotateBackToBackgroundOrientation;
  // un-rotate the zoomed out viewport. this should be precalculated.
  const [ow, oh] = [vp.width, vp.height];
  const [w, h] = rotatedWidthAndHeight(-angle, ow, oh);
  const xOffset = canvas.width > w ? (canvas.width - w) / 2 : 0;
  const yOffset = canvas.height > h ? (canvas.height - h) / 2 : 0;
  // trim selection to viewport
  const [minY, maxY] = [yOffset, yOffset + h];
  const [minX, maxX] = [xOffset, xOffset + w];
  const uPoints: Point[] = [];
  for (const p of points) {
    if (p.y < minY) p.y = minY;
    if (p.x < minX) p.x = minX;
    if (p.y > maxY) p.y = maxY;
    if (p.x > maxX) p.x = maxX;
    uPoints.push(op(-angle, p.x - xOffset, p.y - yOffset, w, h, ow, oh));
  }
  return uPoints;
}

export function scalePoints(points: Point[], zoom: number) {
  const sPoints: Point[] = [];
  for (const p of points) {
    sPoints.push({ x: p.x * zoom, y: p.y * zoom });
  }
  return sPoints;
}

export function translatePoints(points: Point[], x: number, y: number) {
  const tPoints: Point[] = [];
  for (const p of points) {
    tPoints.push({ x: p.x + x, y: p.y + y });
  }
  return tPoints;
}

/**
 * Given a desired viewport, set our current viewport accordingly, set the zoom,
 * and then center the request viewport within our screen, extending its short
 * side to fit our screen.
 *
 * This is used when the remote client is told which region to display, rather
 * than in the editor, where (IIRC) you calculate the viewpoint given a point,
 * a zoom level and the canvas size.
 */
export function zoomFromViewport(
  angle: number,
  containerWidth: number,
  containerHeight: number,
  img: Rect,
) {
  // un-rotate canvas
  const [cW, cH] = rotatedWidthAndHeight(
    -angle,
    containerWidth,
    containerHeight,
  );
  const zW = img.width / cW;
  const zH = img.height / cH;
  return Math.max(zW, zH);
}

/**
 * Given an angle of rotation, zoom factor, container (canvas) size, and requested image,
 * set the viewport to the same aspect of the screen and adjust the image to fill that viewport.
 * @param angle the angle of rotation
 * @param zoom the zoom factor
 * @param containerWidth container (canvas) width
 * @param containerHeight container (canvas) height
 * @param backgroundWidth background image width
 * @param backgroundHeight background image height
 * @param viewport viewport (will be updated)
 * @param image image area (will be updated)
 */
export function adjustImageToViewport(
  angle: number,
  zoom: number,
  containerWidth: number,
  containerHeight: number,
  backgroundWidth: number,
  backgroundHeight: number,
  viewport: Rect,
  image: Rect,
) {
  // screen w/h
  const [cw, ch] = [containerWidth, containerHeight];
  const [rw, rh] = rotatedWidthAndHeight(
    angle,
    backgroundWidth,
    backgroundHeight,
  );

  // center the image - this can put the image x and y into the negatives or
  // increase them so x + width or y + height are greater than the source image
  // the following if block down below corrects those over/under adjustments
  if (image.height / containerHeight > image.width / containerWidth) {
    const adj = Math.round(cw * zoom);
    if (adj < rw) {
      image.x -= (adj - image.width) / 2;
    }
  } else {
    const adj = Math.round(ch * zoom);
    if (adj < rh) {
      image.y -= (adj - image.height) / 2;
    }
  }

  // vp = rotated screen w/h
  [viewport.width, viewport.height] = rotatedWidthAndHeight(-angle, cw, ch);

  // multiply viewport by zoom factor WHICH CAN LEAD TO IMAGE SIZES GREATER THAN ACTUAL IMAGE SIZE
  [image.width, image.height] = [zoom * viewport.width, zoom * viewport.height];
  if (image.width > backgroundWidth) {
    // img (scaled viewport) greater than actual image, so shrink it down and adjust the viewport to fit it
    image.width = backgroundWidth;
    viewport.width = Math.round((viewport.height * image.width) / image.height);
  } else if (image.height > backgroundHeight) {
    // one side of the displayed image region fits into our viewport
    image.height = backgroundHeight;
    viewport.height = Math.round((viewport.width * image.height) / image.width);
  } else if (image.y < 0) {
    // remember, our "image" dimensions are based on our viewport and zoom so if we're off the page, just slide and we'll still fit
    image.y = 0;
  } else if (image.x < 0) {
    // remember, our "image" dimensions are based on our viewport and zoom so if we're off the page, just slide and we'll still fit
    image.x = 0;
  } else if (image.x + image.width > backgroundWidth) {
    image.x = backgroundWidth - image.width;
  } else if (image.y + image.height > backgroundHeight) {
    image.y = backgroundHeight - image.height;
  }
  image.x = Math.round(image.x);
  image.y = Math.round(image.y);
  image.width = Math.round(image.width);
  image.height = Math.round(image.height);
}

export function copyRect(source: Rect, destination: Rect) {
  destination.x = source.x;
  destination.y = source.y;
  destination.width = source.width;
  destination.height = source.height;
}
export function equalRects(r1: Rect, r2: Rect): boolean {
  return (
    r1.x === r2.x &&
    r1.y === r2.y &&
    r1.width === r2.width &&
    r1.height === r2.height
  );
}

/**
 * @param delta the how much to add (or subtract if negative) to the dimensions
 * @param ow original (and minimum) width of token
 * @param oh original (and minimum) height of token
 * @param cw: current width of token
 * @param ch: current height of token
 * @param mw: max width
 * @param mh: max height
 * @return array (width and height) of two numbers
 */
export function adjustTokenDimensions(
  delta: number,
  ow: number,
  oh: number,
  cw: number,
  ch: number,
  mw: number,
  mh: number,
): number[] {
  let dh, dw;
  if (ow > oh) {
    dw = cw + delta;
    dh = Math.round((dw * oh) / ow);
  } else {
    dh = ch + delta;
    dw = Math.round((dh * ow) / oh);
  }
  // don't go passed that max width and height
  if (dw < mw && dh < mh && dw > 0 && dh > 0) {
    cw = dw;
    ch = dh;
  }
  return [cw, ch];
}
