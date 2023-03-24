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

  if (selR >= scrR) {
    let newHeight = selection.width / scrR;
    let newY = selection.y + ((selection.height - newHeight)/2)
    return {x: selection.x, y: newY, width: selection.width, height: newHeight};
  }

  let newWidth = scrR * selection.height;
  let newX = selection.x + ((selection.width - newWidth)/2);
  return {x: newX, y: selection.y, width: newWidth, height: selection.height}
}