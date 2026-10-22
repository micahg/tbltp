jest.mock("../src/utils/drawing", () => {
  class DrawableToken {}
  return {
    createDrawable: jest.fn(),
    DrawableToken,
  };
});

jest.mock("../src/utils/contentworker/render", () => ({
  clearBox: jest.fn(),
  clearCanvas: jest.fn(),
  eraseBrush: jest.fn(),
  fullRerender: jest.fn(),
  renderAllCanvases: jest.fn(),
  renderBox: jest.fn(),
  renderBrush: jest.fn(),
  renderDisplay: jest.fn(),
  renderToken: jest.fn(),
  storeOverlay: jest.fn(() => Promise.resolve()),
}));

jest.mock("../src/utils/contentworker/scene", () => ({
  applyUpdate: jest.fn(() => Promise.resolve()),
}));

jest.mock("../src/utils/contentworker/things", () => ({
  renderThings: jest.fn(),
  thingAt: jest.fn(() => -1),
}));

jest.mock("../src/utils/contentworker/viewport", () => ({
  adjustZoom: jest.fn(),
  adjustZoomFromViewport: jest.fn(),
  calculateViewport: jest.fn(),
  trimPanning: jest.fn(),
  unrotateScaleTranslatePoints: jest.fn(() => [{ x: 600, y: 400 }]),
}));

import {
  createDrawable,
  Drawable,
  DrawableToken,
} from "../src/utils/drawing";
import { dispatch } from "../src/utils/contentworker/messages";
import * as render from "../src/utils/contentworker/render";
import * as scene from "../src/utils/contentworker/scene";
import * as things from "../src/utils/contentworker/things";
import * as viewport from "../src/utils/contentworker/viewport";
import {
  createWorkerState,
  GUIDE_FILL,
  MIN_BRUSH,
} from "../src/utils/contentworker/state";

type FakeToken = {
  token: {
    x: number;
    y: number;
    angle: number;
    scale: number;
  };
  normalize: jest.Mock;
  setOpacity: jest.Mock;
  draw: jest.Mock;
  place: jest.Mock;
};

function makeToken(): FakeToken {
  return {
    token: { x: 0, y: 0, angle: 0, scale: 1 },
    normalize: jest.fn(),
    setOpacity: jest.fn(),
    draw: jest.fn(),
    place: jest.fn(),
  };
}

function asDrawableToken(token: FakeToken): DrawableToken {
  return token as unknown as DrawableToken;
}

function makeContext() {
  return { fillStyle: "" } as unknown as OffscreenCanvasRenderingContext2D;
}

function event(data: Record<string, unknown>): MessageEvent {
  return { data } as MessageEvent;
}

const raf = jest.fn((_callback: FrameRequestCallback) => 1);
const originalRaf = (globalThis as { requestAnimationFrame?: unknown })
  .requestAnimationFrame;

function lastRafCallback(): FrameRequestCallback {
  return raf.mock.calls[raf.mock.calls.length - 1][0] as FrameRequestCallback;
}

beforeAll(() => {
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame =
    raf;
});

afterAll(() => {
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame =
    originalRaf;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(createDrawable).mockReset();
  jest
    .mocked(viewport.unrotateScaleTranslatePoints)
    .mockReturnValue([{ x: 600, y: 400 }]);
  jest.mocked(things.thingAt).mockReturnValue(-1);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("content worker messages", () => {
  it("initializes the visible canvas and settings", async () => {
    const state = createWorkerState();
    const visible = makeContext();
    const offscreen = {
      width: 1024,
      height: 768,
      getContext: jest.fn(() => visible),
    };

    await dispatch(
      state,
      event({
        cmd: "init",
        canvas: offscreen,
        thingsOnTop: true,
        displayOpacity: 0.4,
      }),
      jest.fn(),
    );

    expect(offscreen.getContext).toHaveBeenCalledWith("2d", { alpha: false });
    expect(state.view.canvas).toEqual({
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    });
    expect(state.layers.visible).toBe(visible);
    expect(state.settings.thingsOnTop).toBe(true);
    expect(state.settings.displayOpacity).toBe(0.4);
  });

  it("posts updated and resized after a scene update", async () => {
    const state = createWorkerState();
    const post = jest.fn();
    const values = {
      background: "bg",
      backgroundRev: 1,
      backgroundUrl: "bg-url",
      viewport: { x: 0, y: 0, width: 800, height: 600 },
      angle: 0,
    };
    state.layers.background = { width: 1200, height: 800 } as ImageBitmap;
    state.view.viewport = { x: 0, y: 0, width: 800, height: 533 };

    await dispatch(state, event({ cmd: "update", values }), post);

    expect(scene.applyUpdate).toHaveBeenCalledWith(state, values, post);
    expect(post).toHaveBeenCalledWith({ cmd: "updated" });
    expect(post).toHaveBeenCalledWith({
      cmd: "resized",
      width: 800,
      height: 533,
      fullWidth: 1200,
      fullHeight: 800,
    });
  });

  it("posts updated without resized when no background exists", async () => {
    const state = createWorkerState();
    const post = jest.fn();

    await dispatch(
      state,
      event({ cmd: "update", values: { things: [] } }),
      post,
    );

    expect(post).toHaveBeenCalledWith({ cmd: "updated" });
    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ cmd: "resized" }),
    );
  });

  it("routes things-only updates through applyUpdate", async () => {
    const state = createWorkerState();
    const post = jest.fn();
    const values = { things: [] };

    await dispatch(state, event({ cmd: "things", values }), post);

    expect(scene.applyUpdate).toHaveBeenCalledWith(state, values, post);
  });

  it("starts and finishes a paint stroke", async () => {
    const state = createWorkerState();
    const visible = makeContext();
    const full = makeContext();
    state.layers.visible = visible;
    state.layers.full = full;
    state.view.zoom = 1.5;

    await dispatch(
      state,
      event({ cmd: "paint", x: 10, y: 20, buttons: 0 }),
      jest.fn(),
    );

    expect(state.tools.recording).toBe(true);
    expect(state.tools.pointer.startX).toBe(10);
    expect(state.tools.pointer.startY).toBe(20);
    expect(visible.fillStyle).toBe(GUIDE_FILL);
    expect(raf).toHaveBeenCalled();

    await dispatch(
      state,
      event({ cmd: "paint", x: 30, y: 40, buttons: 1 }),
      jest.fn(),
    );

    expect(state.tools.recording).toBe(false);
    expect(visible.fillStyle).toBe("rgba(255, 0, 0, 1)");
    expect(full.fillStyle).toBe("rgba(255, 0, 0, 1)");
    expect(render.renderBrush).toHaveBeenCalledWith(
      state,
      30,
      40,
      MIN_BRUSH,
    );
  });

  it("repaints the brush guide on animation frames", async () => {
    const state = createWorkerState();
    state.layers.visible = makeContext();
    state.layers.full = makeContext();
    state.view.zoom = 1.5;

    await dispatch(
      state,
      event({ cmd: "paint", x: 10, y: 20, buttons: 0 }),
      jest.fn(),
    );

    const animate = lastRafCallback();
    animate(0);

    expect(render.renderDisplay).toHaveBeenCalledWith(state);
    expect(render.renderBrush).toHaveBeenCalledWith(
      state,
      10,
      20,
      MIN_BRUSH,
      false,
    );
    // The animation schedules the next frame without running it here.
    expect(raf).toHaveBeenCalledTimes(2);
  });

  it("erases at the requested point and brush size", async () => {
    const state = createWorkerState();
    state.tools.brush = 30;

    await dispatch(
      state,
      event({ cmd: "erase", x: 5, y: 6, buttons: 1 }),
      jest.fn(),
    );

    expect(state.tools.recording).toBe(false);
    expect(render.eraseBrush).toHaveBeenCalledWith(state, 5, 6, 30);
  });

  it("reports a completed selection and resets the pointer", async () => {
    const state = createWorkerState();
    const post = jest.fn();

    await dispatch(
      state,
      event({ cmd: "select", x: 10, y: 20, buttons: 1 }),
      post,
    );
    expect(state.tools.selecting).toBe(true);
    expect(state.tools.panning).toBe(false);
    expect(state.tools.recording).toBe(true);

    await dispatch(
      state,
      event({ cmd: "select", x: 100, y: 200, buttons: 1 }),
      post,
    );
    await dispatch(state, event({ cmd: "end_select" }), post);

    expect(post).toHaveBeenCalledWith({
      cmd: "select_complete",
      rect: { x: 10, y: 20, width: 90, height: 180 },
    });
    expect(state.tools.recording).toBe(false);
    expect(state.tools.panning).toBe(false);
    expect(state.tools.pointer.startX).toBe(-1);
    expect(state.tools.pointer.endY).toBe(-1);
  });

  it("draws the selection guide on animation frames", async () => {
    const state = createWorkerState();

    await dispatch(
      state,
      event({ cmd: "select", x: 10, y: 20, buttons: 1 }),
      jest.fn(),
    );
    const animate = lastRafCallback();
    animate(0);

    expect(render.renderDisplay).toHaveBeenCalledWith(state);
    expect(render.renderBox).toHaveBeenCalledWith(
      state,
      10,
      20,
      10,
      20,
      GUIDE_FILL,
      false,
    );
    expect(raf).toHaveBeenCalledTimes(2);
  });

  it("pans the image on animation frames", async () => {
    const state = createWorkerState();
    state.view.zoom = 2;
    state.view.maxZoom = 4;
    state.view.image = { x: 100, y: 100, width: 400, height: 300 };
    state.layers.background = { width: 1200, height: 800 } as ImageBitmap;

    await dispatch(
      state,
      event({ cmd: "move", x: 10, y: 20, buttons: 1 }),
      jest.fn(),
    );
    state.tools.pointer.endX = 30;
    state.tools.pointer.endY = 40;
    const animate = lastRafCallback();
    animate(0);

    expect(state.view.image.x).toBe(140);
    expect(state.view.image.y).toBe(140);
    expect(viewport.trimPanning).toHaveBeenCalledWith(
      state.view.image,
      1200,
      800,
    );
    expect(render.renderDisplay).toHaveBeenCalledWith(state);
  });

  it("reports pan completion from end_select", async () => {
    const state = createWorkerState();
    state.tools.panning = true;
    const post = jest.fn();

    await dispatch(state, event({ cmd: "end_select" }), post);

    expect(post).toHaveBeenCalledWith({ cmd: "pan_complete" });
  });

  it.each(["wait", "end_move", "end_panning"])(
    "stops recording for %s without an unexpected-command error",
    async (cmd) => {
      const state = createWorkerState();
      state.tools.recording = true;
      state.tools.panning = true;
      state.tools.pointer.startX = 10;
      state.tools.pointer.endX = 20;

      await dispatch(state, event({ cmd }), jest.fn());

      expect(state.tools.recording).toBe(false);
      expect(state.tools.panning).toBe(false);
      expect(state.tools.pointer.startX).toBe(-1);
      expect(state.tools.pointer.endX).toBe(-1);
      expect(render.renderDisplay).toHaveBeenCalledWith(state);
      expect(console.error).not.toHaveBeenCalledWith(
        "Unexpected worker command: end_panning",
      );
    },
  );

  it("creates, drags and commits a token", async () => {
    const state = createWorkerState();
    const token = makeToken();
    const copy = makeToken();
    jest
      .mocked(createDrawable)
      .mockResolvedValueOnce(token as unknown as Drawable)
      .mockResolvedValueOnce(copy as unknown as Drawable);
    state.layers.things = makeContext();
    state.view.angle = 90;
    state.view.zoom = 1.5;

    await dispatch(
      state,
      event({ cmd: "set_token", token: { x: 1, y: 2 } }),
      jest.fn(),
    );
    expect(state.tools.token).toBe(token);

    await dispatch(
      state,
      event({ cmd: "token", x: 50, y: 60 }),
      jest.fn(),
    );
    expect(token.token.x).toBe(50);
    expect(token.token.y).toBe(60);
    expect(state.tools.recording).toBe(true);
    expect(raf).toHaveBeenCalled();

    token.token.x = 10;
    token.token.y = 20;
    token.token.angle = 30;
    const post = jest.fn();
    await dispatch(state, event({ cmd: "end_token" }), post);

    expect(viewport.unrotateScaleTranslatePoints).toHaveBeenCalledWith(
      state.view,
      [{ x: 10, y: 20 }],
    );
    expect(token.token.x).toBe(600);
    expect(token.token.y).toBe(400);
    expect(token.token.angle).toBe(30);
    expect(token.normalize).toHaveBeenCalledTimes(2);
    expect(render.renderToken).toHaveBeenCalledWith(
      state.layers.things,
      token,
      1.5,
    );
    expect(state.things).toEqual([copy]);
    expect(post).toHaveBeenCalledWith({
      cmd: "token_placed",
      instance: token.token,
    });
  });

  it("draws the dragged token on animation frames", async () => {
    const state = createWorkerState();
    const token = makeToken();
    state.tools.token = asDrawableToken(token);
    state.layers.visible = makeContext();
    state.view.zoom = 1.5;

    await dispatch(
      state,
      event({ cmd: "token", x: 50, y: 60 }),
      jest.fn(),
    );
    const animate = lastRafCallback();
    animate(0);

    expect(render.renderDisplay).toHaveBeenCalledWith(state);
    expect(render.renderToken).toHaveBeenCalledWith(
      state.layers.visible,
      token,
      1.5,
      true,
    );
    expect(raf).toHaveBeenCalledTimes(2);
  });

  it("redraws the things layer on animation frames", async () => {
    const state = createWorkerState();
    const token = makeToken();
    state.things = [token as unknown as Drawable];
    state.layers.things = makeContext();

    await dispatch(
      state,
      event({ cmd: "move_token", x: 10, y: 20, buttons: 1 }),
      jest.fn(),
    );
    const animate = lastRafCallback();
    animate(0);

    expect(things.renderThings).toHaveBeenCalledWith(
      state.layers.things,
      state.things,
    );
    expect(render.renderDisplay).toHaveBeenCalledWith(state);
    expect(raf).toHaveBeenCalledTimes(2);
  });

  it("moves an existing token and releases it", async () => {
    const state = createWorkerState();
    const token = makeToken();
    state.things = [token as unknown as Drawable];
    jest.mocked(things.thingAt).mockReturnValue(0);
    const post = jest.fn();

    await dispatch(
      state,
      event({ cmd: "move_token", x: 10, y: 20, buttons: 1 }),
      post,
    );

    expect(state.tools.token).toBe(token);
    expect(token.token.x).toBe(600);
    expect(token.token.y).toBe(400);
    expect(things.thingAt).toHaveBeenCalledWith(
      state.things,
      { x: 600, y: 400 },
      DrawableToken,
      expect.any(Function),
      expect.any(Function),
    );

    await dispatch(
      state,
      event({ cmd: "move_token", x: 30, y: 40, buttons: 0 }),
      post,
    );

    expect(token.setOpacity).toHaveBeenCalledWith(1);
    expect(state.tools.token).toBeUndefined();
    expect(post).toHaveBeenCalledWith({
      cmd: "token_moved",
      instance: token.token,
    });
  });

  it("deletes the token under the pointer", async () => {
    const state = createWorkerState();
    const token = makeToken();
    state.things = [token as unknown as Drawable];
    jest.mocked(things.thingAt).mockReturnValue(0);
    const post = jest.fn();

    await dispatch(
      state,
      event({ cmd: "delete_token", x: 10, y: 20 }),
      post,
    );
    expect(state.tools.pointer.startX).toBe(10);
    expect(state.tools.pointer.startY).toBe(20);

    await dispatch(state, event({ cmd: "end_delete_token" }), post);

    expect(state.things).toEqual([]);
    expect(post).toHaveBeenCalledWith({
      cmd: "token_deleted",
      instance: token.token,
    });
  });

  it("maps a zoom selection to a full-image viewport", async () => {
    const state = createWorkerState();
    jest
      .mocked(viewport.unrotateScaleTranslatePoints)
      .mockReturnValueOnce([
        { x: 10, y: 20 },
        { x: 110, y: 220 },
      ]);
    const post = jest.fn();

    await dispatch(
      state,
      event({ cmd: "zoom", rect: { x: 5, y: 6, width: 7, height: 8 } }),
      post,
    );

    expect(post).toHaveBeenCalledWith({
      cmd: "viewport",
      viewport: { x: 10, y: 20, width: 100, height: 200 },
    });
  });

  it("zooms in and out through the current zoom steps", async () => {
    const state = createWorkerState();
    state.layers.background = { width: 1200, height: 800 } as ImageBitmap;
    state.view.zoom = 1.5;
    state.view.maxZoom = 1.5;
    state.view.firstZoomStep = 1;

    await dispatch(
      state,
      event({ cmd: "zoom_in", x: 400, y: 300 }),
      jest.fn(),
    );
    expect(viewport.adjustZoom).toHaveBeenCalledWith(
      state.view,
      1,
      400,
      300,
      1200,
      800,
    );
    expect(render.renderAllCanvases).toHaveBeenCalledWith(state);

    state.view.zoom = 1;
    jest.mocked(viewport.adjustZoom).mockClear();
    await dispatch(
      state,
      event({ cmd: "zoom_out", x: 400, y: 300 }),
      jest.fn(),
    );
    expect(viewport.adjustZoom).toHaveBeenCalledWith(
      state.view,
      1.5,
      400,
      300,
      1200,
      800,
    );
  });

  it("resizes the canvas and reports the new viewport", async () => {
    const state = createWorkerState();
    const post = jest.fn();
    state.layers.background = { width: 1200, height: 800 } as ImageBitmap;
    state.view.viewport = { x: 0, y: 0, width: 640, height: 480 };

    await dispatch(
      state,
      event({ cmd: "resize", width: 640, height: 480 }),
      post,
    );

    expect(state.view.canvas).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 480,
    });
    expect(viewport.adjustZoomFromViewport).toHaveBeenCalledWith(state.view);
    expect(viewport.calculateViewport).toHaveBeenCalledWith(
      state.view,
      1200,
      800,
    );
    expect(viewport.trimPanning).toHaveBeenCalledWith(
      state.view.image,
      1200,
      800,
    );
    expect(render.fullRerender).toHaveBeenCalledWith(state);
    expect(post).toHaveBeenCalledWith({
      cmd: "resized",
      width: 640,
      height: 480,
      fullWidth: 1200,
      fullHeight: 800,
    });
  });

  it("obscures, reveals and clears the overlay", async () => {
    const state = createWorkerState();
    const post = jest.fn();
    state.tools.colour = { red: "1", green: "2", blue: "3" };
    state.tools.renderOpacity = "0.5";

    await dispatch(
      state,
      event({ cmd: "obscure", rect: { x: 1, y: 2, width: 3, height: 4 } }),
      post,
    );
    expect(render.renderBox).toHaveBeenCalledWith(
      state,
      1,
      2,
      4,
      6,
      "rgba(1, 2, 3, 0.5)",
    );
    expect(render.storeOverlay).toHaveBeenCalledWith(state, post);

    await dispatch(
      state,
      event({ cmd: "reveal", rect: { x: 1, y: 2, width: 3, height: 4 } }),
      post,
    );
    expect(render.clearBox).toHaveBeenCalledWith(state, 1, 2, 4, 6);

    await dispatch(state, event({ cmd: "clear" }), post);
    expect(render.clearCanvas).toHaveBeenCalledWith(state);
    expect(render.storeOverlay).toHaveBeenCalledTimes(3);
  });

  it("updates opacity and colour state", async () => {
    const state = createWorkerState();

    await dispatch(
      state,
      event({ cmd: "opacity", opacity: "0.25" }),
      jest.fn(),
    );
    expect(state.tools.renderOpacity).toBe("0.25");

    await dispatch(
      state,
      event({ cmd: "display_opacity", opacity: 0.75 }),
      jest.fn(),
    );
    expect(state.settings.displayOpacity).toBe(0.75);
    expect(render.renderDisplay).toHaveBeenCalledWith(state);

    await dispatch(
      state,
      event({ cmd: "colour", red: "4", green: "5", blue: "6" }),
      jest.fn(),
    );
    expect(state.tools.colour).toEqual({ red: "4", green: "5", blue: "6" });
  });

  it("adjusts brush size and token scale/rotation", async () => {
    const state = createWorkerState();
    const token = makeToken();
    state.tools.token = asDrawableToken(token);
    token.token.scale = 0.5;

    await dispatch(
      state,
      event({ cmd: "brush_inc", action: "token" }),
      jest.fn(),
    );
    expect(token.token.scale).toBe(1);

    token.token.scale = 1.5;
    await dispatch(
      state,
      event({ cmd: "brush_dec", action: "token" }),
      jest.fn(),
    );
    expect(token.token.scale).toBe(1);

    await dispatch(
      state,
      event({ cmd: "brush_inc", action: "brush" }),
      jest.fn(),
    );
    expect(state.tools.brush).toBe(MIN_BRUSH * 2);
    await dispatch(
      state,
      event({ cmd: "brush_dec", action: "brush" }),
      jest.fn(),
    );
    expect(state.tools.brush).toBe(MIN_BRUSH);

    token.token.angle = 10;
    await dispatch(
      state,
      event({ cmd: "brush_rot", action: "token", delta: 1 }),
      jest.fn(),
    );
    expect(token.token.angle).toBe(25);
    expect(token.normalize).toHaveBeenCalled();
  });

  it("logs unexpected commands", async () => {
    await dispatch(
      createWorkerState(),
      event({ cmd: "not-a-command" }),
      jest.fn(),
    );

    expect(console.error).toHaveBeenCalledWith(
      "Unexpected worker command: not-a-command",
    );
  });
});
