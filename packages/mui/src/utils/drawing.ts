import { Rect } from "./geometry";

export type DrawContext = CanvasDrawPath &
  CanvasPathDrawingStyles &
  CanvasFillStrokeStyles &
  CanvasPath;

export interface Drawable {
  draw(ctx: DrawContext): void;
}

export type Thing = SelectedRegion | Marker;

export type SelectedRegion = {
  base: "SelectedRegion";
  rect: Rect;
};

export type Marker = {
  base: "Marker";
  value: "hi";
};

export function newSelectedRegion(rect: Rect): SelectedRegion {
  return {
    base: "SelectedRegion",
    rect: rect,
  };
}

class DrawableSelectedRegion implements Drawable {
  region: SelectedRegion;
  constructor(region: SelectedRegion) {
    this.region = region;
  }
  draw(ctx: DrawContext) {
    const [x, y] = [this.region.rect.x, this.region.rect.y];
    const [x1, y1] = [x + this.region.rect.width, y + this.region.rect.height];
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

export function newDrawableThing(thing: Thing): Drawable | undefined {
  if (thing.base === "SelectedRegion") return new DrawableSelectedRegion(thing);
}

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
