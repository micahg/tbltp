import {
  createDrawable,
  Drawable,
  Drawables,
  isDrawableType,
} from "../drawing";
import { Point } from "../geometry";

export async function updateThings(
  current: Drawable[],
  things?: unknown[],
): Promise<void> {
  // clear the existing thing list
  current.length = 0;

  // cheese it if there are no things to render
  if (!things) return;

  const promises: Promise<Drawable>[] = [];
  for (const thing of things.filter((thing) => thing)) {
    promises.push(createDrawable(thing));
  }
  let drawables: Drawable[];
  try {
    drawables = await Promise.all(promises);
  } catch (err) {
    console.error(`Unable to load things: ${JSON.stringify(err)}`);
    if ("stack" in (err as Error)) {
      console.error((err as Error).stack);
    }
    return;
  }
  drawables.forEach((d) => current.push(d));
}

export function renderThings(
  ctx: OffscreenCanvasRenderingContext2D | undefined,
  things: Drawable[],
): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const thing of things) {
    try {
      ctx.save();
      thing.draw(ctx);
      ctx.restore();
    } catch (err) {
      console.error(err);
    }
  }
}

/**
 * Find the thing at a point
 * @param things the drawables to search
 * @param p the unrotated and scaled point
 * @param dt optional drawable type restriction
 * @returns the index of the thing at the given point
 */
export function thingAt<T = Drawables>(
  things: Drawable[],
  p: Point,
  dt?: T,
  contained?: (thing: Drawable) => void,
  notContained?: (thing: Drawable) => void,
): number {
  let idx = -1;
  for (const [i, t] of things.entries()) {
    // ensure we enforce the type restriction
    if (dt !== undefined && !isDrawableType(t, dt)) continue;

    // check the point, apply the function
    if (t.contains(p.x, p.y) && idx < 0) {
      idx = i;
      if (contained) contained(t);
    } else if (notContained) notContained(t);
  }
  return idx;
}
