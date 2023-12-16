import { getRect } from "./drawing";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageBound {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: boolean;
}

/**
 * Get the screen width and height, taking into consideration the offsets.
 * @returns an array of two numbers: width & height.
 */
export function getWidthAndHeight(): number[] {
  const width = Math.max(
    document.documentElement.clientWidth || 0,
    document.documentElement.offsetWidth || 0,
    window.innerWidth || 0,
  );
  const height = Math.max(
    document.documentElement.clientHeight || 0,
    document.documentElement.offsetHeight || 0,
    window.innerHeight || 0,
  );

  return [width, height];
}

export function getMaxContainerSize(screenWidth: number, screenHeight: number) {
  const padding = 48; // 2 * 24 vertically and horizontally
  const vOffset = screenWidth < 600 ? 48 : 64 + padding; // App Bar changes based on window width
  const hOffset = padding;
  const width = screenWidth - hOffset;
  const height = screenHeight - vOffset;
  return [width, height];
}

export function getScaledContainerSize(
  screenWidth: number,
  screenHeight: number,
  imageWidth: number,
  imageHeight: number,
) {
  const scale = Math.min(screenWidth / imageWidth, screenHeight / imageHeight);
  return [Math.round(imageWidth * scale), Math.round(imageHeight * scale)];
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
): number[] {
  /**
   * This is a modified rotration algorithm that does its final transposition
   * after rotation assuming that instead of returning to the starting point,
   * you are returning to the origin of your unrotated image based on its
   * unrotated width and height.
   */
  const d_x = x - w / 2;
  const d_y = y - h / 2;
  const [r_x, r_y] = rot(angle, d_x, d_y);
  const o_x = ow / 2;
  const o_y = oh / 2;
  return [r_x + o_x, r_y + o_y];
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

export function scaleSelection(
  selection: Rect,
  viewport: Rect,
  width: number,
  height: number,
) {
  const v_w = viewport.width - viewport.x;
  const v_h = viewport.height - viewport.y;
  const h_scale = width / v_w;
  const v_scale = height / v_h;
  return {
    x: selection.x * h_scale,
    y: selection.y * v_scale,
    width: selection.width * h_scale,
    height: selection.height * v_scale,
  };
}

/**
 * rotate and fill viewport to fit screen/window/canvas
 * @param screen screen [width, height]
 * @param image image [width, height] (actual -- might get shrunk by browser)
 * @param oImage image [width, height] (original -- as the editor saw it -- possibly shrunk but we dont' handle that yet)
 * @param angle angle of rotation
 * @param viewport viewport withing the original image {x, y, w, h}
 * @returns
 */
export function fillRotatedViewport(
  screen: number[],
  image: number[],
  oImage: number[],
  angle: number,
  viewport: Rect,
) {
  if (
    viewport.x === 0 &&
    viewport.y === 0 &&
    viewport.width === oImage[0] &&
    viewport.height === oImage[1]
  ) {
    return getRect(0, 0, image[0], image[1]);
  }
  const rScreen = rotatedWidthAndHeight(angle, screen[0], screen[1]);
  const selR = viewport.width / viewport.height;
  const scrR = rScreen[0] / rScreen[1];
  let { x, y, width: w, height: h } = viewport;

  // const newVP = { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height };
  if (scrR > selR) {
    const offset = Math.round((h * scrR - w) / 2);
    w = Math.round(h * scrR);
    if (x - offset < 0)
      x = 0; // shunt to left screen bound rather than render a partial image
    else if (x + w > oImage[0]) x = oImage[0] - w;
    // shunt to right screen bound rather than render a partial image
    else x -= offset;
  } else {
    const offset = Math.round((w / scrR - h) / 2);
    h = Math.round(w / scrR);
    if (y - offset < 0) y = 0;
    else if (y + h + offset > oImage[1]) y = oImage[1] - h;
    else y -= offset;
  }
  // calculate coefficient for browser-resized images
  // We shouldn't need to square (**2) the scaling value; however, I
  // think due to a browser bug, squaring silkScale below is what works.
  // FWIW, the bug was filed here:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1494756
  const silkScale = (image[0] / oImage[0]) ** 2;
  return {
    x: x * silkScale,
    y: y * silkScale,
    width: w * silkScale,
    height: h * silkScale,
  };
}
