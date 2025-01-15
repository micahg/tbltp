import { Rect, Token, TokenInstance } from "@micahg/tbltp-common";

export type DrawContext = CanvasDrawPath &
  CanvasPathDrawingStyles &
  CanvasFillStrokeStyles &
  CanvasPath;

export interface Drawable {
  draw(ctx: DrawContext): void;
}

export type Thing = SelectedRegion | Marker;

export function isRect(r: unknown): r is Rect {
  return (
    !!r &&
    typeof r === "object" &&
    typeof (r as Rect).x === "number" &&
    typeof (r as Rect).y === "number" &&
    typeof (r as Rect).width === "number" &&
    typeof (r as Rect).height === "number"
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

export function createDrawable<T = Rect>(d: T): Drawable {
  // if (isPoint(d)) return new DrawablePoint(d);
  // if (isToken(d)) return new DrawableToken(d);
  if (isRect(d)) return new DrawableSelectedRegion(d);
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

// MICAH: NEED HYDRATED INSTANCE TOKEN THAT INCLUDES IMAGE + A TOKEN CACHE
// class DrawableToken implements Drawable {
//   token: TokenInstance;
//   constructor(token: TokenInstance) {
//     this.token = token;
//   }
//   draw(ctx: DrawContext) {
//     this.token.token
//     // ctx.beginPath();
//     // ctx.arc(this.token.x, this.token.y, 10, 0, 2 * Math.PI);
//     // ctx.fillStyle = "black";
//     // ctx.fill();
//     const [_token_dw, _token_dh] = [this.token.width, this.token.height];
//     ctx.translate(-_token_dw / 2, -_token_dh / 2);
//     ctx.drawImage(
//       vamp,
//       // source (should always just be source dimensions)
//       0,
//       0,
//       vamp.width,
//       vamp.height,
//       // destination (adjust according to scale)
//       x,
//       y,
//       _token_dw,
//       _token_dh,
//     );
//   }
// }
