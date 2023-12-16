import { Rect, calculateBounds, rotatedWidthAndHeight } from "./geometry";

export const CONTROLS_HEIGHT = 46;

export function getRect(x1: number, y1: number, x2: number, y2: number): Rect {
  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (x1 > x2) {
    x = x2;
    w = x1 - x2;
  } else {
    x = x1;
    w = x2 - x1;
  }
  if (y1 > y2) {
    y = y2;
    h = y1 - y2;
  } else {
    y = y1;
    h = y2 - y1;
  }
  return { x: x, y: y, width: w, height: h };
}
/**
 * Load an image.
 * @param uri the URI of the image to load
 * @returns a promise that resolves to an HTMLImageElement
 */
export function loadImage(uri: string): Promise<HTMLImageElement> {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = function () {
      // just to mess with stuff silk (amazon browser) will resize us here,
      // to 1.599905190803508 smaller, screwing up our viewports. Its
      // probably a ram constraint...
      resolve(this as HTMLImageElement);
    };
    img.onerror = function (error) {
      reject(error);
    };
    // Anonymous only works if the server cors are setup... Setting it avoids the
    // error:
    //
    //    The canvas has been tainted by cross-origin data.
    //
    // from happening when we (later) call getImageData on the overlay BUT have
    // loaded the overlay with an existing image from localhost:3000. The problem
    // originates from the fact that our frontend in dev is on localhost:4200 and
    // I don't think cross-origin is setup properly for static data on the nose
    // server
    img.crossOrigin = "Anonymous";
    img.src = uri;
  });
}

export function renderViewPort(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  angle: number,
  viewport: Rect,
) {
  const [rv_w, rv_h] = rotatedWidthAndHeight(
    angle,
    viewport.width,
    viewport.height,
  );
  const bounds = calculateBounds(
    ctx.canvas.width,
    ctx.canvas.height,
    rv_w,
    rv_h,
  );
  const [b_x, b_y] = [bounds.width, bounds.height];
  const [c_x, c_y] = rotatedWidthAndHeight(-angle, b_x, b_y);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(
    image,
    viewport.x,
    viewport.y,
    viewport.width,
    viewport.height,
    -c_x / 2,
    -c_y / 2,
    c_x,
    c_y,
  );
  ctx.restore();
  return;
}
