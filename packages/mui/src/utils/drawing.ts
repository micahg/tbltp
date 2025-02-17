/**
 * FOR TESTING THE MAIN SCENE IS 66106a4b867826e1074c9476
 * to remove from the other scene:
 *  db.tokeninstances.remove({scene: ObjectId("66106a6e867826e1074c9484")})
 *  db.tokeninstances.remove({scene: { $ne: ObjectId("66106a4b867826e1074c9476")}});
 */

import { Rect, HydratedTokenInstance } from "@micahg/tbltp-common";
import { loadImage } from "./content";

export type DrawContext = CanvasDrawPath &
  CanvasPathDrawingStyles &
  CanvasFillStrokeStyles &
  CanvasCompositing &
  CanvasTransform &
  CanvasDrawImage &
  CanvasState &
  CanvasPath;

export interface Drawable {
  setOpacity(opacity: number): void;
  draw(ctx: DrawContext): void;
  contains(x: number, y: number): boolean;
  region(zoom: number): Rect;
}

export type Drawables = DrawableSelectedRegion | DrawableToken;

type BitmapCache = {
  [key: string]: ImageBitmap;
};

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
    typeof (d as HydratedTokenInstance).token === "string" &&
    typeof (d as HydratedTokenInstance).asset === "string"
  );
}

export function isDrawableToken(d: unknown): d is DrawableToken {
  return !!d && (d as DrawableToken).token !== undefined;
}

export function isDrawableSelectedRegion(
  d: unknown,
): d is DrawableSelectedRegion {
  return !!d && (d as DrawableSelectedRegion).rect !== undefined;
}

export function isDrawableType<T = Drawables>(d: unknown, t: T): boolean {
  switch (t) {
    case DrawableToken:
      return isDrawableToken(d);
    case DrawableSelectedRegion:
      return isDrawableSelectedRegion(d);
    default:
      return false;
  }
}

export type SelectedRegion = {
  rect: Rect;
};

export type Marker = {
  base: "Marker";
  // TODO this should be a URL along with a point
  value: "hi";
};

export async function createDrawable<T = Rect | HydratedTokenInstance>(
  d: T,
  bearer: string,
): Promise<Drawable> {
  if (isRect(d)) return new DrawableSelectedRegion(d);
  if (isHydratedTokenInstnace(d)) {
    const img = await cacheTokenImage(d.asset, bearer);
    return new DrawableToken(d, img);
  }
  throw new TypeError("Invalid Drawable");
}

export class DrawableSelectedRegion implements Drawable {
  rect: Rect;
  opacity: number;
  constructor(rect: Rect) {
    this.rect = rect;
    this.opacity = 1;
  }
  setOpacity(opacity: number): void {
    this.opacity = opacity;
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

  // TODO THIS NEEDS TO HANDLE ZOOM IF I EVER USE IT
  region(zoom: number): Rect {
    return this.rect;
  }

  contains(x: number, y: number): boolean {
    return (
      x >= this.rect.x &&
      x <= this.rect.x + this.rect.width &&
      y >= this.rect.y &&
      y <= this.rect.y + this.rect.height
    );
  }
}

// TODO try with bad link and see what happens before merging - ideally fallack to X
async function cacheTokenImage(location: string, bearer: string) {
  const url = location || "/x.webp";
  if (url in cache) return cache[url];
  console.warn(`Cache miss for token ${url}`);

  const img = await loadImage(url, bearer);
  cache[url] = img;
  return img;
}

export class DrawableToken implements Drawable {
  opacity: number;
  token: HydratedTokenInstance;
  img: ImageBitmap;
  constructor(token: HydratedTokenInstance, img: ImageBitmap) {
    this.token = token;
    this.img = img;
    this.opacity = 1;
  }

  normalize() {
    while (this.token.angle < 0) this.token.angle += 360;
    while (this.token.angle >= 360) this.token.angle -= 360;
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
  }

  contains(x: number, y: number): boolean {
    // compensate for centered token
    const dx = x + this.img.width / 2;
    const dy = y + this.img.height / 2;
    return (
      dx >= this.token.x &&
      dx <= this.token.x + this.img.width &&
      dy >= this.token.y &&
      dy <= this.token.y + this.img.height
    );
  }

  region(zoom: number): Rect {
    // calcualte the size coefficient
    const sizeCo = this.token.scale / zoom;
    const [width, height] = [this.img.width * sizeCo, this.img.height * sizeCo];
    const [x, y] = [this.token.x - width / 2, this.token.y - height / 2];
    return {
      x: x,
      y: y,
      width: width,
      height: height,
    };
  }
  /**
   *
   * @param ctx
   * @param zoom is the background divided by the visible canvas size
   * Math.max(_fullRotW / _canvas.width, _fullRotH / _canvas.height);
   */
  place(ctx: DrawContext, zoom: number) {
    // TODO: don't draw if not in region

    // calcualte the size coefficient
    const sizeCo = this.token.scale / zoom;
    const [_token_dw, _token_dh] = [
      this.img.width * sizeCo,
      this.img.height * sizeCo,
    ];

    ctx.translate(this.token.x, this.token.y);
    ctx.rotate((this.token.angle * Math.PI) / 180);
    ctx.translate(-_token_dw / 2, -_token_dh / 2);
    ctx.globalAlpha = this.opacity;
    ctx.drawImage(
      this.img,
      // source (should always just be source dimensions)
      0,
      0,
      this.img.width,
      this.img.height,
      // destination
      0,
      0,
      _token_dw,
      _token_dh,
    );
    ctx.globalAlpha = 1;
  }

  draw = (ctx: DrawContext) => this.place(ctx, 1);
}
