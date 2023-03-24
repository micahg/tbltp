import { calculateBounds, ImageBound, Rect } from "./geometry";

export const CONTROLS_HEIGHT = 46;
let baseData: ImageData | null = null;
let overlayInitialized: boolean = false;

export function getRect(x1: number, y1: number, x2: number, y2: number): Rect {
  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (x1 > x2) {
    x = x2;
    w = x1-x2;
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
  return { x: x, y: y, width: w, height: h};
}
/**
 * Load an image.
 * @param uri the URI of the image to load
 * @returns a promise that resolves to an HTMLImageElement
 */
export function loadImage(uri: string): Promise<HTMLImageElement> {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = function() { resolve(this as HTMLImageElement); }
    img.onerror = function(error) { reject(error); }
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
    img.crossOrigin = 'Anonymous';
    img.src = uri;
  });
}
/*export function loadImage(data: Blob): Promise<HTMLImageElement>;
export function loadImage(data: string | Blob): Promise<HTMLImageElement> {
  const img = new Image();
  if (typeof data ==='string') {
    return new Promise((resolve, reject) => {
      img.onload = function() { resolve(this as HTMLImageElement); }
      img.onerror = function() { reject('Image load failed'); }
      img.src = data;
    });
  } else {
    return new Promise((resolve, reject) => {
      img.onload = function() {
        resolve(this as HTMLImageElement);
      }
      img.onerror = function() {
        reject('Image load failed');
      }
      img.src = URL.createObjectURL(data);
      console.log(`MICAH SIGH`);
    });
  }
}*/

export function renderImage(image: HTMLImageElement, ctx: CanvasRenderingContext2D,
  resizeCanvas: boolean = false, withControls: boolean = true,
  viewport: Rect | null = null): Promise<ImageBound> {

  if (resizeCanvas) {
    const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) - (withControls ? CONTROLS_HEIGHT : 0);
    ctx.canvas.width = width;
    ctx.canvas.height = height;
    ctx.canvas.style.width = `${width}px`;
    ctx.canvas.style.height = `${height}px`;
  }

  if (!ctx) return Promise.reject(`Unable to get canvas context`);

  let bounds = calculateBounds(ctx.canvas.width, ctx.canvas.height, image.width, image.height);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(ctx.canvas.width/2, ctx.canvas.height/2);
  if (bounds.rotate) {
    ctx.rotate(90 * Math.PI/180);
  }
  if (viewport != null) {
    ctx.drawImage(image,
      viewport.x, viewport.y, viewport.width, viewport.height,
      -bounds.width/2, -bounds.height/2, bounds.width, bounds.height);  
  } else {
    ctx.drawImage(image, -bounds.width/2, -bounds.height/2, bounds.width, bounds.height);
  }
  ctx.restore();

  return Promise.resolve(bounds);
}

export function initOverlay() {
  overlayInitialized = true;
}

export function setupOverlayCanvas(bounds: ImageBound, ctx: CanvasRenderingContext2D): Promise<void> {
  // avoid rerender after initialization
  if (overlayInitialized) {
    return Promise.resolve();
  }

  ctx.canvas.width = bounds.width;
  ctx.canvas.height = bounds.height;
  ctx.canvas.style.width = `${bounds.width}px`;
  ctx.canvas.style.height = `${bounds.height}px`;
  ctx.canvas.style.top = `${bounds.top}px`;
  ctx.canvas.style.left = `${bounds.left}px`;

  ctx.save();
  overlayInitialized = true;
  return Promise.resolve();
}

export function obscureOverlay(this: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  if (baseData === null) return;
  this.putImageData(baseData, 0, 0);
  this.fillStyle = "rgba(255, 0, 0, 1)";
  this.fillRect(x1,y1,x2-x1,y2-y1);
  baseData = this.getImageData(0, 0, this.canvas.width, this.canvas.height);
}

export function revealOverlay(this: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  if (baseData === null) return;
  this.putImageData(baseData, 0, 0);
  this.clearRect(x1,y1,x2-x1,y2-y1);
  baseData = this.getImageData(0, 0, this.canvas.width, this.canvas.height);
}


/**
 * Store off the default overlay image data. When using this method, you must
 * bind the context to it because "this" is expected to be a 2D context.
 * 
 * @param this the overlay canvas context from which to store the image data.
 */
export function storeOverlay(this: CanvasRenderingContext2D) {
  if (baseData !== null) return;
  baseData = this.getImageData(0, 0, this.canvas.width, this.canvas.height);
}


/**
 * Render a selection on a canvas context. When using this method, you must
 * bind the context to it because "this" is expected to be a 2D context.
 * 
 * @param this the overlay canvas context upon which to render a selection.
 * @param x1 the first x coordinate
 * @param y1 the first y coordinate
 * @param x2 the second x coordinate
 * @param y2 teh second y coordinate
 */
export function selectOverlay(this: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  if (baseData === null) return;
  this.putImageData(baseData, 0, 0);
  this.fillStyle = "rgba(255, 255, 255, 0.25)";
  this.fillRect(x1,y1,x2-x1,y2-y1);
}

export function clearOverlaySelection(this: CanvasRenderingContext2D) {
  if (baseData === null) return;
  this.putImageData(baseData, 0, 0);
}