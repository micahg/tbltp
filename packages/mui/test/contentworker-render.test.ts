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
  renderStreamFrame,
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
    scale: jest.fn(),
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

  describe("renderStreamFrame", () => {
    function makeStreamState(width: number, height: number) {
      const state = createWorkerState();
      state.layers.full = asContext(makeContext(1200, 800));
      state.post = jest.fn();
      state.stream.on = true;
      state.stream.ctx = asContext(makeContext(width, height));
      state.stream.view.canvas = {
        x: 0,
        y: 0,
        width,
        height,
      };
      return state;
    }

    function streamCtx(state: ReturnType<typeof makeStreamState>) {
      return state.stream.ctx as unknown as ReturnType<typeof makeContext>;
    }

    it("is a no-op until the stream is started", () => {
      const state = makeStreamState(1920, 1080);
      state.stream.on = false;
      state.layers.playerBackground = { width: 1200, height: 800 } as ImageBitmap;

      renderStreamFrame(state);

      const ctx = streamCtx(state);
      expect(ctx.clearRect).not.toHaveBeenCalled();
      expect(state.post).not.toHaveBeenCalled();
    });

    it("does nothing without a background", () => {
      const state = makeStreamState(1920, 1080);

      renderStreamFrame(state);

      expect(state.post).not.toHaveBeenCalled();
    });

    it("renders the full player background when no viewport is requested", () => {
      const state = makeStreamState(1920, 1080);
      // the GM background must never be preferred for the stream
      state.layers.background = { width: 600, height: 400 } as ImageBitmap;
      state.layers.playerBackground = {
        width: 1200,
        height: 800,
      } as ImageBitmap;
      const bitmap = { close: jest.fn() };
      const ctx = streamCtx(state);
      ctx.canvas.transferToImageBitmap.mockReturnValue(bitmap);

      renderStreamFrame(state);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
      expect(ctx.translate).toHaveBeenCalledWith(960, 540);
      expect(ctx.rotate).toHaveBeenCalledWith(0);
      // the 1200x800 image fills the 1080-high stream, letterboxed to 1620 wide
      expect(ctx.drawImage).toHaveBeenNthCalledWith(
        1,
        state.layers.playerBackground,
        0,
        0,
        1200,
        800,
        -810,
        -540,
        1620,
        1080,
      );
      const overlay = (state.layers.full as unknown as ReturnType<
        typeof makeContext
      >).canvas;
      expect(ctx.drawImage).toHaveBeenNthCalledWith(
        2,
        overlay,
        0,
        0,
        1200,
        800,
        -810,
        -540,
        1620,
        1080,
      );
      expect(ctx.canvas.transferToImageBitmap).toHaveBeenCalled();
      expect(state.post).toHaveBeenCalledWith(
        { cmd: "stream_frame", bitmap },
        [bitmap],
      );
    });

    it("fits the requested viewport and draws placed tokens only", () => {
      const state = makeStreamState(800, 600);
      state.layers.playerBackground = {
        width: 1200,
        height: 800,
      } as ImageBitmap;
      state.stream.view.requested = {
        x: 300,
        y: 200,
        width: 600,
        height: 400,
      };
      const token = {
        token: { x: 0, y: 0, angle: 0, scale: 1 },
        opacity: 1,
        draw: jest.fn(),
      };
      const guide = {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        opacity: 1,
        draw: jest.fn(),
      };
      state.things = [token, guide] as never;
      const ctx = streamCtx(state);

      renderStreamFrame(state);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(ctx.translate).toHaveBeenCalledWith(400, 300);
      // the 600x400 request is centered and extended to 600x450
      expect(ctx.drawImage).toHaveBeenNthCalledWith(
        1,
        state.layers.playerBackground,
        300,
        175,
        600,
        450,
        -400,
        -300,
        800,
        600,
      );
      // tokens draw in background coordinates via the viewport mapping
      expect(ctx.translate).toHaveBeenCalledWith(-400, -300);
      expect(ctx.scale).toHaveBeenCalledWith(800 / 600, 600 / 450);
      expect(ctx.translate).toHaveBeenCalledWith(-300, -175);
      expect(token.draw).toHaveBeenCalledWith(ctx);
      // the GM viewport guide never appears in the stream
      expect(guide.draw).not.toHaveBeenCalled();
      const overlay = (state.layers.full as unknown as ReturnType<
        typeof makeContext
      >).canvas;
      expect(ctx.drawImage).toHaveBeenNthCalledWith(
        2,
        overlay,
        300,
        175,
        600,
        450,
        -400,
        -300,
        800,
        600,
      );
      expect(state.post).toHaveBeenCalled();
    });

    it("ships a frame on every call (pacing belongs to the stream timer)", () => {
      const state = makeStreamState(800, 600);
      state.layers.playerBackground = {
        width: 1200,
        height: 800,
      } as ImageBitmap;
      const ctx = streamCtx(state);

      renderStreamFrame(state);
      renderStreamFrame(state);

      expect(ctx.canvas.transferToImageBitmap).toHaveBeenCalledTimes(2);
      expect(state.post).toHaveBeenCalledTimes(2);
    });

    it("is not driven by display renders", () => {
      const state = makeStreamState(800, 600);
      state.layers.playerBackground = {
        width: 1200,
        height: 800,
      } as ImageBitmap;
      state.layers.visible = asContext(makeContext());
      state.layers.background = {
        width: 1200,
        height: 800,
      } as ImageBitmap;

      renderDisplay(state);

      expect(state.post).not.toHaveBeenCalled();
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
