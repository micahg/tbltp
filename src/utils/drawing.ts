import { calculateBounds } from "./geometry";

export const IMG_URI: string = 'map-gnomegarde-pc.jpg';
export const CONTROLS_HEIGHT = 46;
let baseData: ImageData | null = null;

/**
 * Load an image.
 * @param uri the URI of the image to load
 * @returns a promise that resolves to an HTMLImageElement
 */
export function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.id = 'mapImage'
    img.onload = function() { resolve(this as HTMLImageElement); }
    img.onerror = function() { reject('Image load failed'); }
    img.src = uri;
  });
}

export function renderImage(image: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<void> {

  const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
  const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) - CONTROLS_HEIGHT;


  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (!ctx) return Promise.reject(`Unable to get canvas context`);

  let bounds = calculateBounds(canvas.width, canvas.height, image.width, image.height);
  console.log(`Scaled Image is ${bounds.width} x ${bounds.height}`)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  if (bounds.rotate) {
    ctx.rotate(90 * Math.PI/180);
  }
  ctx.drawImage(image, -bounds.width/2, -bounds.height/2, bounds.width, bounds.height);
  ctx.restore();

  return Promise.resolve();
}

export function setupOverlayCanvas(background: HTMLCanvasElement, overlay: HTMLCanvasElement, overlayCtx: CanvasRenderingContext2D): Promise<void> {
  overlay.width = background.width;
  overlay.height = background.height;
  overlay.style.width = `${background.width}px`;
  overlay.style.height = `${background.height}px`;
  overlayCtx.save();
  return Promise.resolve();
}

export function obscureOverlay(overlayCtx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  console.log(`${x}, ${y}, ${width}, ${height}`)
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
  this.fillStyle = "rgba(0, 0, 0, 0.25)";
  this.fillRect(x1,y1,x2-x1,y2-y1);
}