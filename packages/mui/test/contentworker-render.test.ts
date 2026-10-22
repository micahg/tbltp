import { createWorkerState } from "../src/utils/contentworker/state";
import {
  clearBox,
  clearCanvas,
  eraseBrush,
  fullRerender,
  renderAllCanvases,
  renderBox,
  renderBrush,
  renderDisplay,
  renderToken,
  storeOverlay,
} from "../src/utils/contentworker/render";

function makeContext(width = 800, height = 600) {
  const canvas = {
    width,
    height,
    transferToImageBitmap: jest.fn(),
    convertToBlob: jest.fn(),
  };
  return {
    canvas,
    globalAlpha: 1,
    fillStyle: "",
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    drawImage: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn(),
  };
}

function asContext(ctx: ReturnType<typeof makeContext>) {
  return ctx as unknown as OffscreenCanvasRenderingContext2D;
}

function makeState() {
  const state = createWorkerState();
  state.view.canvas = { x: 0, y: 0, width: 800, height: 600 };
  state.view.viewport = { x: 0, y: 0, width: 800, height: 600 };
  state.view.image = { x: 10, y: 20, width: 300, height: 200 };
  state.view.angle = 0;
  state.view.zoom = 1.5;
  state.layers.visible = asContext(makeContext());
  state.layers.full = asContext(makeContext());
  state.layers.things = asContext(makeContext());
  return state;
}

describe("content worker render", () => {
  describe("renderDisplay", () => {
    it("draws the background then each composition layer with display opacity", () => {
      const state = makeState();
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;
      const background = { width: 1200, height: 800 } as ImageBitmap;
      const layerA = {} as CanvasImageSource;
      const layerB = {} as CanvasImageSource;
      state.layers.background = background;
      state.layers.composition = [layerA, layerB];
      state.settings.displayOpacity = 0.25;

      renderDisplay(state);

      expect(visible.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(visible.translate).toHaveBeenCalledWith(400, 300);
      expect(visible.rotate).toHaveBeenCalledWith(0);
      expect(visible.drawImage).toHaveBeenNthCalledWith(
        1,
        background,
        10,
        20,
        300,
        200,
        -400,
        -300,
        800,
        600,
      );
      expect(visible.drawImage).toHaveBeenNthCalledWith(
        2,
        layerA,
        10,
        20,
        300,
        200,
        -400,
        -300,
        800,
        600,
      );
      expect(visible.drawImage).toHaveBeenNthCalledWith(
        3,
        layerB,
        10,
        20,
        300,
        200,
        -400,
        -300,
        800,
        600,
      );
      expect(visible.globalAlpha).toBe(0.25);
      expect(visible.restore).toHaveBeenCalled();
    });

    it("only clears when there is nothing to compose", () => {
      const state = makeState();
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;

      renderDisplay(state);

      expect(visible.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(visible.save).not.toHaveBeenCalled();
      expect(visible.drawImage).not.toHaveBeenCalled();
    });
  });

  describe("renderAllCanvases", () => {
    it("resizes the visible canvas and renders things and the display", () => {
      const state = makeState();
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;
      const thingsCtx = state.layers.things as unknown as ReturnType<
        typeof makeContext
      >;
      visible.canvas.width = 0;
      visible.canvas.height = 0;
      state.layers.background = { width: 1200, height: 800 } as ImageBitmap;
      state.things = [
        {
          draw: jest.fn(),
          contains: jest.fn(),
          setOpacity: jest.fn(),
        },
      ];

      renderAllCanvases(state);

      expect(visible.canvas.width).toBe(800);
      expect(visible.canvas.height).toBe(600);
      expect(thingsCtx.clearRect).toHaveBeenCalled();
      expect(state.things[0].draw).toHaveBeenCalledWith(thingsCtx);
      expect(visible.drawImage).toHaveBeenCalled();
    });

    it("does nothing until a background exists", () => {
      const state = makeState();
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;

      renderAllCanvases(state);

      expect(visible.canvas.width).toBe(800);
      expect(visible.clearRect).not.toHaveBeenCalled();
    });
  });

  describe("renderBrush", () => {
    it("draws the screen-space guide without touching the image", () => {
      const state = makeState();
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;

      renderBrush(state, 10, 20, 5, false);

      expect(visible.arc).toHaveBeenCalledWith(10, 20, 5, 0, 2 * Math.PI);
      expect(visible.fill).toHaveBeenCalled();
      expect(full.arc).not.toHaveBeenCalled();
    });

    it("transforms the brush to the full image and rerenders the display", () => {
      const state = makeState();
      state.view.viewport = { x: 0, y: 0, width: 800, height: 600 };
      state.view.image = { x: 0, y: 0, width: 1200, height: 900 };
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;
      state.layers.background = { width: 1200, height: 900 } as ImageBitmap;

      renderBrush(state, 100, 100, 10);

      expect(full.arc).toHaveBeenCalledWith(
        150,
        150,
        15,
        0,
        2 * Math.PI,
      );
      expect(full.fill).toHaveBeenCalled();
      expect(visible.drawImage).toHaveBeenCalled();
    });
  });

  describe("renderBox and clearBox", () => {
    it("draws a transformed box on the full image", () => {
      const state = makeState();
      state.view.viewport = { x: 0, y: 0, width: 800, height: 600 };
      state.view.image = { x: 0, y: 0, width: 1200, height: 900 };
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;
      state.layers.background = { width: 1200, height: 900 } as ImageBitmap;

      renderBox(state, 100, 100, 300, 250, "red");

      expect(full.fillStyle).toBe("red");
      expect(full.fillRect).toHaveBeenCalledWith(150, 150, 300, 225);
    });

    it("clears a transformed box from the full image", () => {
      const state = makeState();
      state.view.viewport = { x: 0, y: 0, width: 800, height: 600 };
      state.view.image = { x: 0, y: 0, width: 1200, height: 900 };
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;

      clearBox(state, 100, 100, 300, 250);

      expect(full.clearRect).toHaveBeenCalledWith(150, 150, 300, 225);
    });
  });

  describe("eraseBrush", () => {
    it("uses an inverse clip to remove a circular region", () => {
      const state = makeState();
      state.view.viewport = { x: 0, y: 0, width: 800, height: 600 };
      state.view.image = { x: 0, y: 0, width: 1200, height: 900 };
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;
      const bitmap = { close: jest.fn() };
      full.canvas.transferToImageBitmap.mockReturnValue(bitmap);
      state.layers.background = { width: 1200, height: 900 } as ImageBitmap;

      eraseBrush(state, 100, 100, 10);

      expect(full.canvas.transferToImageBitmap).toHaveBeenCalled();
      expect(full.rect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(full.arc).toHaveBeenCalledWith(
        150,
        150,
        15,
        0,
        2 * Math.PI,
        true,
      );
      expect(full.clip).toHaveBeenCalled();
      expect(full.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
      expect(bitmap.close).toHaveBeenCalled();
    });
  });

  describe("clearCanvas", () => {
    it("clears the full image and rerenders the display", () => {
      const state = makeState();
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;
      state.layers.background = { width: 1200, height: 800 } as ImageBitmap;

      clearCanvas(state);

      expect(full.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(visible.drawImage).toHaveBeenCalled();
    });
  });

  describe("renderToken", () => {
    it("uses place while dragging and draw when committed", () => {
      const ctx = makeContext();
      const token = {
        place: jest.fn(),
        draw: jest.fn(),
      };

      renderToken(
        ctx as unknown as OffscreenCanvasRenderingContext2D,
        token as never,
        2,
        true,
      );
      expect(token.place).toHaveBeenCalledWith(ctx, 2);
      expect(token.draw).not.toHaveBeenCalled();

      renderToken(
        ctx as unknown as OffscreenCanvasRenderingContext2D,
        token as never,
        2,
      );
      expect(token.draw).toHaveBeenCalledWith(ctx);
      expect(ctx.save).toHaveBeenCalledTimes(2);
      expect(ctx.restore).toHaveBeenCalledTimes(2);
    });
  });

  describe("fullRerender", () => {
    it("recalculates zoom and viewport and renders all canvases", () => {
      const state = makeState();
      state.view.canvas = { x: 0, y: 0, width: 800, height: 600 };
      state.view.image = { x: 0, y: 0, width: 0, height: 0 };
      state.view.viewport = { x: 0, y: 0, width: 0, height: 0 };
      state.view.zoom = undefined;
      state.view.fullRotW = 1200;
      state.view.fullRotH = 800;
      state.layers.background = { width: 1200, height: 800 } as ImageBitmap;
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;

      fullRerender(state);

      expect(state.view.maxZoom).toBe(1.5);
      expect(state.view.firstZoomStep).toBe(1.5);
      expect(state.view.zoom).toBe(1.5);
      expect(state.view.viewport).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 533,
      });
      expect(state.view.image).toEqual({
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
      });
      expect(visible.drawImage).toHaveBeenCalled();
    });

    it("does nothing without a background", () => {
      const state = makeState();
      const visible = state.layers.visible as unknown as ReturnType<
        typeof makeContext
      >;

      fullRerender(state);

      expect(visible.drawImage).not.toHaveBeenCalled();
      expect(state.view.zoom).toBe(1.5);
    });
  });

  describe("storeOverlay", () => {
    it("posts the converted full canvas as an overlay blob", async () => {
      const state = makeState();
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;
      const blob = { size: 123 } as Blob;
      full.canvas.convertToBlob.mockResolvedValue(blob);
      const post = jest.fn();

      await storeOverlay(state, post);

      expect(full.canvas.convertToBlob).toHaveBeenCalled();
      expect(post).toHaveBeenCalledWith({ cmd: "overlay", blob });
    });

    it("resolves without posting when the full canvas is missing", async () => {
      const state = makeState();
      state.layers.full = undefined;
      const post = jest.fn();

      await expect(storeOverlay(state, post)).resolves.toBeUndefined();
      expect(post).not.toHaveBeenCalled();
    });

    it("logs conversion failures instead of rejecting", async () => {
      const state = makeState();
      const full = state.layers.full as unknown as ReturnType<
        typeof makeContext
      >;
      full.canvas.convertToBlob.mockRejectedValue(new Error("no blob"));
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      const post = jest.fn();

      await expect(storeOverlay(state, post)).resolves.toBeUndefined();
      expect(error).toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    });
  });
});
