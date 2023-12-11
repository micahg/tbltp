import { Rect } from "./tablestate";

export function validateViewPort(viewport: Rect): boolean {
  if (!viewport) return false;
  if (viewport.x === null || viewport.x === undefined) return false;
  if (viewport.y === null || viewport.y === undefined) return false;
  if (viewport.width === null || viewport.width === undefined) return false;
  if (viewport.height === null || viewport.height === undefined) return false;
  return true;
}

export function validateAngle(angle: unknown): boolean {
  if (typeof angle !== 'number') return false;
  if (angle < 0 || angle >= 360) return false;
  return true;
}