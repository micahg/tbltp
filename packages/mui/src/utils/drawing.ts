/**
 * FOR TESTING THE MAIN SCENE IS 66106a4b867826e1074c9476
 * to remove from the other scene:
 *  db.tokeninstances.remove({scene: ObjectId("66106a6e867826e1074c9484")})
 */

import { Rect, HydratedTokenInstance } from "@micahg/tbltp-common";
import { loadImage } from "./content";

export type DrawContext = CanvasDrawPath &
  CanvasPathDrawingStyles &
  CanvasFillStrokeStyles &
  CanvasTransform &
  CanvasDrawImage &
  CanvasPath;

export interface Drawable {
  draw(ctx: DrawContext): void;
}

export type Thing = SelectedRegion | Marker;

type BitmapCache = {
  [key: string]: ImageBitmap;
};

let DEFAULT_TOIKEN: ImageBitmap;

const cache: BitmapCache = {};

export function isRect(d: unknown): d is Rect {
  return (
    !!d &&
    typeof d === "object" &&
    typeof (d as Rect).x === "number" &&
    typeof (d as Rect).y === "number" &&
    typeof (d as Rect).width === "number" &&
    typeof (d as Rect).height === "number"
  );
}

export function isHydratedTokenInstnace(
  d: unknown,
): d is HydratedTokenInstance {
  return (
    !!d &&
    typeof d === "object" &&
    typeof (d as HydratedTokenInstance).x === "number" &&
    typeof (d as HydratedTokenInstance).y === "number" &&
    typeof (d as HydratedTokenInstance).token === "string"
  );
}

export type SelectedRegion = {
  rect: Rect;
};

export type Marker = {
  base: "Marker";
  // TODO this should be a URL along with a point
  value: "hi";
};

export async function createDrawable<T = Rect>(
  d: T,
  bearer: string,
): Promise<Drawable> {
  if (isRect(d)) return new DrawableSelectedRegion(d);
  if (isHydratedTokenInstnace(d)) {
    const img = await cacheTokenImage(d.token, bearer);
    return new DrawableToken(d, img);
  }
  throw new TypeError("Invalid Drawable");
}

class DrawableSelectedRegion implements Drawable {
  rect: Rect;
  constructor(rect: Rect) {
    this.rect = rect;
  }
  draw(ctx: DrawContext) {
    const [x, y] = [this.rect.x, this.rect.y];
    const [x1, y1] = [x + this.rect.width, y + this.rect.height];
    ctx.beginPath();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "black";
    ctx.setLineDash([]);
    ctx.moveTo(x, y);
    ctx.lineTo(x1, y);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x, y1);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = "white";
    ctx.setLineDash([10, 10]);
    ctx.moveTo(x, y);
    ctx.lineTo(x1, y);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x, y1);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

// TODO try with bad link and see what happens before merging - ideally fallack to X
async function cacheTokenImage(location: string, bearer: string) {
  if (location in cache) return cache[location];
  console.warn(`Cache miss for token ${location}`);

  const img = await loadImage(location || "/x.webp", bearer);
  cache[location] = img;
  return img;
}

class DrawableToken implements Drawable {
  token: HydratedTokenInstance;
  img: ImageBitmap;
  constructor(token: HydratedTokenInstance, img: ImageBitmap) {
    this.token = token;
    this.img = img;
  }
  place(ctx: DrawContext) {
    // TODO: don't draw if not in region
    const [_token_dw, _token_dh] = [this.img.width, this.img.height];
    ctx.translate(-_token_dw / 2, -_token_dh / 2);
    ctx.drawImage(
      this.img,
      // source (should always just be source dimensions)
      0,
      0,
      this.img.width,
      this.img.height,
      // destination (adjust according to scale)
      this.token.x,
      this.token.y,
      _token_dw,
      _token_dh,
    );
  }

  draw(ctx: DrawContext) {
    // TODO: don't draw if not in region
    const [_token_dw, _token_dh] = [this.img.width, this.img.height];
    ctx.translate(-_token_dw / 2, -_token_dh / 2);
    ctx.drawImage(
      this.img,
      // source (should always just be source dimensions)
      0,
      0,
      this.img.width,
      this.img.height,
      // destination (adjust according to scale)
      this.token.x,
      this.token.y,
      _token_dw,
      _token_dh,
    );
  }
}
