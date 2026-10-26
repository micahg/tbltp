jest.mock("../src/utils/content", () => ({
  loadImage: jest.fn(),
}));

jest.mock("../src/utils/contentworker/render", () => ({
  clearCanvas: jest.fn(),
  fullRerender: jest.fn(),
  renderDisplay: jest.fn(),
}));

jest.mock("../src/utils/contentworker/things", () => ({
  renderThings: jest.fn(),
  updateThings: jest.fn(() => Promise.resolve()),
}));

import * as content from "../src/utils/content";
import * as render from "../src/utils/contentworker/render";
import * as things from "../src/utils/contentworker/things";
import {
  applyUpdate,
  loadSceneLayers,
} from "../src/utils/contentworker/scene";
import {
  createWorkerState,
  LayerState,
  TableUpdate,
} from "../src/utils/contentworker/state";

type FakeContext = {
  canvas: FakeOffscreenCanvas;
  drawImage: jest.Mock;
};

class FakeOffscreenCanvas {
  width: number;
  height: number;
  ctx: FakeContext;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = { canvas: this, drawImage: jest.fn() };
  }

  getContext = jest.fn(() => this.ctx);
}

const loadImage = jest.mocked(content.loadImage);
const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown })
  .OffscreenCanvas;

function makeBitmap(width = 1200, height = 800): ImageBitmap {
  return {
    width,
    height,
    close: jest.fn(),
  } as unknown as ImageBitmap;
}

function makeUpdate(overrides: Partial<TableUpdate> = {}): TableUpdate {
  return {
    background: "bg",
    backgroundRev: 1,
    backgroundUrl: "bg-url",
    overlay: "overlay",
    overlayRev: 1,
    overlayUrl: "overlay-url",
    viewport: { x: 0, y: 0, width: 800, height: 600 },
    angle: 0,
    tokens: [],
    things: [],
    ...overrides,
  };
}

function makeLayers(): LayerState {
  return {
    backgroundKey: {},
    overlayKey: {},
    playerBackgroundKey: {},
    composition: [],
  };
}

beforeAll(() => {
  (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas =
    FakeOffscreenCanvas;
});

afterAll(() => {
  (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas =
    originalOffscreenCanvas;
});

beforeEach(() => {
  jest.clearAllMocks();
  loadImage.mockReset();
});

describe("content worker scene loading", () => {
  it("loads and caches the background and overlay by location and revision", async () => {
    const background = makeBitmap();
    const overlay = makeBitmap();
    loadImage
      .mockResolvedValueOnce(background)
      .mockResolvedValueOnce(overlay);
    const layers = makeLayers();
    const post = jest.fn();

    const result = await loadSceneLayers(layers, makeUpdate(), post);

    expect(loadImage).toHaveBeenNthCalledWith(
      1,
      "bg-url",
      expect.any(Function),
    );
    expect(loadImage).toHaveBeenNthCalledWith(
      2,
      "overlay-url",
      expect.any(Function),
    );
    expect(layers.background).toBe(background);
    expect(layers.backgroundKey).toEqual({ src: "bg", rev: 1 });
    expect(layers.overlay).toBe(overlay);
    expect(layers.overlayKey).toEqual({ src: "overlay", rev: 1 });
    expect(result).toEqual({ background, overlay });

    const progress = loadImage.mock.calls[0][1];
    progress?.({ img: "bg-url", progress: 0.5 });
    expect(post).toHaveBeenCalledWith({
      cmd: "progress",
      evt: { img: "bg-url", progress: 0.5 },
    });
  });

  it("does not refetch when only a re-signed url changes", async () => {
    const background = makeBitmap();
    const overlay = makeBitmap();
    loadImage
      .mockResolvedValueOnce(background)
      .mockResolvedValueOnce(overlay);
    const layers = makeLayers();
    await loadSceneLayers(layers, makeUpdate(), jest.fn());
    loadImage.mockClear();

    const result = await loadSceneLayers(
      layers,
      makeUpdate({
        backgroundUrl: "bg-url-with-new-signature",
        overlayUrl: "overlay-url-with-new-signature",
      }),
      jest.fn(),
    );

    expect(loadImage).not.toHaveBeenCalled();
    expect(result.background).toBe(background);
    expect(result.overlay).toBe(overlay);
    expect(background.close).not.toHaveBeenCalled();
    expect(overlay.close).not.toHaveBeenCalled();
  });

  it("releases the cached overlay when the scene no longer has one", async () => {
    const overlay = makeBitmap();
    const layers = makeLayers();
    loadImage
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(overlay);
    await loadSceneLayers(layers, makeUpdate(), jest.fn());
    loadImage.mockClear();

    const result = await loadSceneLayers(
      layers,
      makeUpdate({
        overlay: undefined,
        overlayRev: undefined,
        overlayUrl: undefined,
      }),
      jest.fn(),
    );

    expect(loadImage).not.toHaveBeenCalled();
    expect(overlay.close).toHaveBeenCalled();
    expect(layers.overlay).toBeUndefined();
    expect(layers.overlayKey).toEqual({ src: undefined, rev: undefined });
    expect(result.overlay).toBeUndefined();
  });

  it("replaces a cached overlay when its revision changes", async () => {
    const oldOverlay = makeBitmap();
    const newOverlay = makeBitmap();
    const layers = makeLayers();
    loadImage
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(oldOverlay);
    await loadSceneLayers(layers, makeUpdate(), jest.fn());
    loadImage.mockReset();
    loadImage.mockResolvedValueOnce(newOverlay);

    const result = await loadSceneLayers(
      layers,
      makeUpdate({
        overlayRev: 2,
        overlayUrl: "overlay-v2-url",
      }),
      jest.fn(),
    );

    expect(loadImage).toHaveBeenCalledTimes(1);
    expect(loadImage).toHaveBeenCalledWith(
      "overlay-v2-url",
      expect.any(Function),
    );
    expect(oldOverlay.close).toHaveBeenCalled();
    expect(layers.overlay).toBe(newOverlay);
    expect(layers.overlayKey).toEqual({ src: "overlay", rev: 2 });
    expect(result.overlay).toBe(newOverlay);
  });

  it("shares the background bitmap when no separate player image is sent", async () => {
    const background = makeBitmap();
    loadImage
      .mockResolvedValueOnce(background)
      .mockResolvedValueOnce(makeBitmap());
    const layers = makeLayers();

    await loadSceneLayers(layers, makeUpdate(), jest.fn());

    // the player background is the background: no extra download
    expect(loadImage).toHaveBeenCalledTimes(2);
    expect(layers.playerBackground).toBe(background);
    expect(layers.playerBackgroundKey).toEqual({ src: "bg", rev: 1 });
  });

  it("loads a separate player background and caches it by revision", async () => {
    const player = makeBitmap(600, 400);
    loadImage
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(player);
    const layers = makeLayers();

    await loadSceneLayers(
      layers,
      makeUpdate({
        playerBackground: "player",
        playerBackgroundUrl: "player-url",
        playerBackgroundRev: 1,
      }),
      jest.fn(),
    );

    expect(loadImage).toHaveBeenNthCalledWith(
      3,
      "player-url",
      expect.any(Function),
    );
    expect(layers.playerBackground).toBe(player);
    expect(layers.playerBackgroundKey).toEqual({ src: "player", rev: 1 });
    expect(layers.background).not.toBe(player);

    // a re-signed url alone must not refetch the player image
    loadImage.mockClear();
    await loadSceneLayers(
      layers,
      makeUpdate({
        playerBackground: "player",
        playerBackgroundUrl: "player-url-with-new-signature",
        playerBackgroundRev: 1,
      }),
      jest.fn(),
    );
    expect(loadImage).not.toHaveBeenCalled();
    expect(layers.playerBackground).toBe(player);
  });

  it("reloads the player background when its revision changes", async () => {
    const newPlayer = makeBitmap(600, 400);
    loadImage
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(newPlayer);
    const layers = makeLayers();
    const update = {
      playerBackground: "player",
      playerBackgroundUrl: "player-url",
      playerBackgroundRev: 1,
    };
    await loadSceneLayers(layers, makeUpdate(update), jest.fn());
    loadImage.mockClear();

    await loadSceneLayers(
      layers,
      makeUpdate({ ...update, playerBackgroundRev: 2 }),
      jest.fn(),
    );

    expect(loadImage).toHaveBeenCalledTimes(1);
    expect(layers.playerBackground).toBe(newPlayer);
    expect(layers.playerBackgroundKey).toEqual({ src: "player", rev: 2 });
  });
});

describe("content worker applyUpdate", () => {
  it("updates the view, creates layer canvases and draws the overlay", async () => {
    const background = makeBitmap();
    const overlay = makeBitmap();
    loadImage
      .mockResolvedValueOnce(background)
      .mockResolvedValueOnce(overlay);
    const state = createWorkerState();
    state.view.canvas = { x: 0, y: 0, width: 800, height: 600 };
    const values = makeUpdate({
      angle: 90,
      viewport: { x: 300, y: 200, width: 600, height: 400 },
      things: [{ id: "thing" }],
    });

    await applyUpdate(state, values, jest.fn());

    expect(things.updateThings).toHaveBeenCalledWith(
      state.things,
      values.things,
    );
    expect(state.view.angle).toBe(90);
    expect(state.view.requested).toEqual(values.viewport);
    // the stream view tracks the same requested viewport
    expect(state.stream.view.requested).toEqual(values.viewport);
    expect(state.view.fullRotW).toBe(800);
    expect(state.view.fullRotH).toBe(1200);
    expect(state.layers.full).toBeDefined();
    expect(state.layers.things).toBeDefined();
    expect(state.layers.composition).toEqual([
      (state.layers.things as unknown as FakeContext).canvas,
      (state.layers.full as unknown as FakeContext).canvas,
    ]);
    expect(
      (state.layers.full as unknown as FakeContext).drawImage,
    ).toHaveBeenCalledWith(overlay, 0, 0);
    expect(render.renderDisplay).not.toHaveBeenCalled();
    expect(render.clearCanvas).not.toHaveBeenCalled();
    expect(render.fullRerender).toHaveBeenCalledWith(state, false);
  });

  it("reverses the composition when things should render on top", async () => {
    loadImage
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(makeBitmap());
    const state = createWorkerState();
    state.view.canvas = { x: 0, y: 0, width: 800, height: 600 };
    state.settings.thingsOnTop = true;

    await applyUpdate(state, makeUpdate(), jest.fn());

    expect(state.layers.composition).toEqual([
      (state.layers.full as unknown as FakeContext).canvas,
      (state.layers.things as unknown as FakeContext).canvas,
    ]);
  });

  it("clears the full canvas when there is no overlay", async () => {
    loadImage.mockResolvedValueOnce(makeBitmap());
    const state = createWorkerState();
    state.view.canvas = { x: 0, y: 0, width: 800, height: 600 };

    await applyUpdate(
      state,
      makeUpdate({
        overlay: undefined,
        overlayRev: undefined,
        overlayUrl: undefined,
      }),
      jest.fn(),
    );

    expect(render.clearCanvas).toHaveBeenCalledWith(state);
    expect(render.fullRerender).toHaveBeenCalledWith(state, false);
  });

  it("handles a things-only update without a background", async () => {
    const state = createWorkerState();
    const values = makeUpdate({
      background: undefined,
      backgroundRev: undefined,
      backgroundUrl: undefined,
      overlay: undefined,
      overlayRev: undefined,
      overlayUrl: undefined,
      things: [{ id: "thing" }],
    });

    await applyUpdate(state, values, jest.fn());

    expect(things.updateThings).toHaveBeenCalledWith(
      state.things,
      values.things,
    );
    expect(things.renderThings).toHaveBeenCalledWith(
      state.layers.things,
      state.things,
    );
    expect(render.renderDisplay).toHaveBeenCalledWith(state);
    expect(render.fullRerender).not.toHaveBeenCalled();
  });

  it("copies the viewport into the stream view on a things-only update", async () => {
    const state = createWorkerState();
    const viewport = { x: 100, y: 50, width: 400, height: 300 };

    await applyUpdate(
      state,
      makeUpdate({
        background: undefined,
        backgroundRev: undefined,
        backgroundUrl: undefined,
        overlay: undefined,
        overlayRev: undefined,
        overlayUrl: undefined,
        things: [],
        viewport,
      }),
      jest.fn(),
    );

    expect(state.stream.view.requested).toEqual(viewport);
    // the GM view must not be hijacked by the player viewport
    expect(state.view.requested).toEqual({
      x: -1,
      y: -1,
      width: -1,
      height: -1,
    });
  });

  it("resets the stream viewport when an update carries no viewport", async () => {
    const state = createWorkerState();
    state.stream.view.requested = { x: 100, y: 50, width: 400, height: 300 };
    loadImage
      .mockResolvedValueOnce(makeBitmap())
      .mockResolvedValueOnce(makeBitmap());

    await applyUpdate(
      state,
      makeUpdate({ viewport: undefined }),
      jest.fn(),
    );

    expect(state.stream.view.requested).toEqual({
      x: -1,
      y: -1,
      width: -1,
      height: -1,
    });
  });

  it("ignores an update with neither a background nor things", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const state = createWorkerState();

    await applyUpdate(
      state,
      makeUpdate({
        background: undefined,
        backgroundRev: undefined,
        backgroundUrl: undefined,
        overlay: undefined,
        overlayRev: undefined,
        overlayUrl: undefined,
        things: undefined,
      }),
      jest.fn(),
    );

    expect(things.updateThings).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("Ignoring update without background");
  });

  it("logs image load failures without creating layers", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    loadImage.mockRejectedValueOnce(new Error("load failed"));
    const state = createWorkerState();
    state.view.canvas = { x: 0, y: 0, width: 800, height: 600 };

    await applyUpdate(state, makeUpdate(), jest.fn());

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Unable to load images on update"),
    );
    expect(state.layers.full).toBeUndefined();
    expect(state.layers.things).toBeUndefined();
    expect(render.fullRerender).not.toHaveBeenCalled();
  });
});
