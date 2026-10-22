import { Rect } from "@micahg/tbltp-common";
import {
  Point,
  adjustImageToViewport,
  copyRect,
  createPoints,
  rotateBackToBackgroundOrientation,
  rotatedWidthAndHeight,
  scalePoints,
  translatePoints,
  unrotatePoints,
  zoomFromViewport,
} from "../geometry";
import type { ViewState } from "./state";

export function trimPanning(
  image: Rect,
  backgroundWidth: number,
  backgroundHeight: number,
): void {
  if (image.x <= 0) image.x = 0;
  if (image.y <= 0) image.y = 0;

  // if viewport > image then panning gets weird
  if (image.width >= backgroundWidth) image.x = 0;
  else if (image.x + image.width > backgroundWidth)
    image.x = backgroundWidth - image.width;
  if (image.height >= backgroundHeight) image.y = 0;
  else if (image.y + image.height > backgroundHeight)
    image.y = backgroundHeight - image.height;
}

export function calculateViewport(
  view: ViewState,
  backgroundWidth: number,
  backgroundHeight: number,
): void {
  // REMEMBER THIS METHOD UPDATES THE viewport and the image
  if (view.zoom === undefined) return;
  adjustImageToViewport(
    view.angle,
    view.zoom,
    view.canvas.width,
    view.canvas.height,
    backgroundWidth,
    backgroundHeight,
    view.viewport,
    view.image,
  );
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
export function adjustZoomFromViewport(view: ViewState): void {
  // if we do not have a requested image region to view then exit this method
  if (view.requested.x < 0) return;

  // set our viewport to the initial value requested
  copyRect(view.requested, view.image);

  view.zoom = zoomFromViewport(
    view.angle,
    view.canvas.width,
    view.canvas.height,
    view.image,
  );
}

/**
 * Given a single point on the overlay, un-rotate and scale to the full size overlay
 */
export function unrotateScaleTranslatePoints(
  view: ViewState,
  points: Point[],
): Point[] {
  const ps: Point[] = [];
  for (const p of translatePoints(
    scalePoints(
      unrotatePoints(view.angle, view.viewport, view.canvas, points),
      view.zoom ?? 0,
    ),
    view.image.x,
    view.image.y,
  )) {
    ps.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  return ps;
}

/**
 * Given two points on the overlay, un-rotate and scale to the full size overlay
 */
export function unrotateBox(
  view: ViewState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number, number, number] {
  const op = rotateBackToBackgroundOrientation;
  // un-rotate the zoomed out viewport. this should be precalculated.
  const [w, h] = rotatedWidthAndHeight(
    -view.angle,
    view.viewport.width,
    view.viewport.height,
  );
  const [ow, oh] = [view.viewport.width, view.viewport.height];
  const xOffset = view.canvas.width > w ? (view.canvas.width - w) / 2 : 0;
  const yOffset = view.canvas.height > h ? (view.canvas.height - h) / 2 : 0;

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

  const zoom = view.zoom ?? 0;
  const p1 = scalePoints(
    [op(-view.angle, x1 - xOffset, y1 - yOffset, w, h, ow, oh)],
    zoom,
  )[0];
  const p2 = scalePoints(
    [op(-view.angle, x2 - xOffset, y2 - yOffset, w, h, ow, oh)],
    zoom,
  )[0];
  p1.x += view.image.x;
  p1.y += view.image.y;
  p2.x += view.image.x;
  p2.y += view.image.y;
  return [p1.x, p1.y, p2.x - p1.x, p2.y - p1.y];
}

export function adjustZoom(
  view: ViewState,
  zoom: number,
  x: number,
  y: number,
  backgroundWidth: number,
  backgroundHeight: number,
): void {
  if (view.zoom === undefined) return;

  const [cW, cH] = rotatedWidthAndHeight(
    view.angle,
    view.canvas.width,
    view.canvas.height,
  );
  const p = unrotatePoints(
    view.angle,
    view.viewport,
    view.canvas,
    createPoints([x, y]),
  )[0];
  const q = scalePoints([p], view.zoom)[0];
  q.x += view.image.x;
  q.y += view.image.y;
  view.zoom = zoom;
  calculateViewport(view, backgroundWidth, backgroundHeight);
  // calculate any offsets for where we are completely zoomed in in one dimension
  // note that we accommodate for the rotation
  const yOffset = view.viewport.height < cH ? cH - view.viewport.height : 0;
  const xOffset = view.viewport.width < cW ? cW - view.viewport.width : 0;
  // calculate point relative to new viewport
  const newX = p.x - xOffset;
  const newY = p.y - yOffset;
  view.image.x = q.x - view.zoom * newX;
  view.image.y = q.y - view.zoom * newY;
  trimPanning(view.image, backgroundWidth, backgroundHeight);
}
