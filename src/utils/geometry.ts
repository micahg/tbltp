import { text } from "stream/consumers";
import { getRect } from "./drawing";

export interface Rect {
  x: number,
  y: number,
  width: number,
  height: number,
};

export interface ImageBound {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: boolean;
}

export function calculateBounds(canvasWidth: number, canvasHeight: number, imageWidth: number, imageHeight: number) {
  let result:ImageBound = {left: 0, top: 0, height: 0, width: 0, rotate: false};
  let wideImage: boolean = imageWidth >= imageHeight;
  let wideCanvas: boolean = canvasWidth >= canvasHeight;
  let rotate = (wideCanvas !== wideImage)

  if ((canvasWidth >= canvasHeight && imageWidth >= imageHeight) ||
      (canvasHeight > canvasWidth && imageHeight >= imageWidth)) {
    let scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
    result.width = imageWidth * scale;
    result.height = imageHeight * scale;
    result.top = (canvasHeight - result.height)/2;
    result.left = (canvasWidth - result.width)/2;
  } else {
    let scale = Math.min(canvasWidth / imageHeight, canvasHeight / imageWidth);
    result.width =  imageWidth * scale;
    result.height = imageHeight * scale;
    result.top = (canvasHeight - result.width)/2;
    result.left = (canvasWidth - result.height)/2;
    result.rotate = true;
  }

  result.rotate = rotate;
  return result;
}

/**
 * Rotate a point around the center of a rectangle
 * @param angle the angle of rotation
 * @param x the X coordinate of the point
 * @param y the Y coordinate of the point
 * @param width the width of the rectangle
 * @param height the height of the rectangle
 * @returns an array of length two, containing the rotated X and Y cordinate values
 */
export function rotate(angle: number, x: number, y: number, width: number, height: number): number[] {
  let r = Math.PI * (angle/180);
  let c_x = width/2;
  let c_y = height/2;
  let t_x = x - c_x; // translated x
  let t_y = y - c_y; // translated y
  let mcos = Math.cos(r);
  let msin = Math.sin(r);
  // any math i can look up says this is wrong. The final addends of each
  // line are flipped (c_y should be c_x and c_x should be c_y)...
  let x1 = (mcos * t_x) - (msin * t_y) + c_y;
  let y1 = (msin * t_x) + (mcos * t_y) + c_x;
  return [x1, y1]
}

export function rotateRect(angle: number, rect: Rect, width: number, height: number) {
  let [x1, y1] = rotate(-90, rect.x, rect.y, width, height);
  let [x2, y2] = rotate(-90, rect.x + rect.width, rect.y + rect.height, width, height);
  [x1, x2] = [Math.min(x1, x2), Math.max(x1, x2)];
  [y1, y2] = [Math.min(y1, y2), Math.max(y1, y2)];
  let r: Rect = {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
  return r;
}

export function scaleSelection(selection: Rect, viewport: Rect, width: number, height: number) {
  let v_w = viewport.width - viewport.x;
  let v_h = viewport.height - viewport.y;
  let h_scale = width/v_w;
  let v_scale = height/v_h;
  let res: Rect = {
    x: selection.x * h_scale, y: selection.y * v_scale,
    width: selection.width * h_scale, height: selection.height * v_scale,
  };
  return res;
}

export function fillToAspect(selection: Rect | null, width: number, height: number) {
  if (!selection) return getRect(0, 0, width, height);
  if (selection.x === 0 && selection.y === 0 && selection.width === width && selection.height === height) {
    return getRect(0, 0, width, height);
  }

  let selR = selection.width / selection.height;
  let scrR = width/height;

  // if the selection ratio is greater than the screen ratio it implies
  // aspect ratio of the selection is wider than the aspect ratio of the
  // screen, so the height can be scaled up to match the screen/image ratio
  if (selR >= scrR) {
    let newHeight = selection.width / scrR;
    let newY = selection.y + ((selection.height - newHeight)/2)

    // these bits ensure we render from the edge rather than show black
    if (newY < 0) newY = 0;
    if (newY + newHeight > height) newY = height - newHeight;

    return {x: selection.x, y: newY, width: selection.width, height: newHeight};
  }

  // conversly, if the selection ratio is less than the screen ratio, it implies
  // that the aspect ratio of the selection is less than the aspect ratio of the
  // screen, so the width can be scaled up to match the screen/image ratio
  let newWidth = scrR * selection.height;
  let newX = selection.x + ((selection.width - newWidth)/2);

  // these bits ensure we render from the edge rather than show black
  if (newX < 0) newX = 0;
  if (newX + newWidth > width) newX = width - newWidth;

  return {x: newX, y: selection.y, width: newWidth, height: selection.height}
}