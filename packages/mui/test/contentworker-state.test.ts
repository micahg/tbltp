import {
  createWorkerState,
  GUIDE_FILL,
  MIN_BRUSH,
  ZOOM_STEP,
} from "../src/utils/contentworker/state";

describe("content worker state", () => {
  it("creates the expected initial state", () => {
    const state = createWorkerState();

    expect(state.view.canvas).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(state.view.requested).toEqual({
      x: -1,
      y: -1,
      width: -1,
      height: -1,
    });
    expect(state.view.zoom).toBeUndefined();
    expect(state.layers.composition).toEqual([]);
    expect(state.layers.backgroundKey).toEqual({});
    expect(state.layers.overlayKey).toEqual({});
    expect(state.tools.brush).toBe(MIN_BRUSH);
    expect(state.tools.renderOpacity).toBe("1");
    expect(state.tools.colour).toEqual({ red: "255", green: "0", blue: "0" });
    expect(state.tools.pointer.lastAnimX).toBe(-1);
    expect(state.tools.pointer.lastAnimY).toBe(-1);
    expect(state.things).toEqual([]);
    expect(state.settings.thingsOnTop).toBe(false);
    expect(state.settings.displayOpacity).toBe(1);
  });

  it("uses the shared drawing constants", () => {
    expect(GUIDE_FILL).toBe("rgba(255, 255, 255, 0.25)");
    expect(ZOOM_STEP).toBe(0.5);
  });

  it("creates independent state instances", () => {
    const first = createWorkerState();
    const second = createWorkerState();

    first.view.angle = 90;
    first.view.canvas.width = 800;
    first.layers.backgroundKey.src = "first";
    first.layers.composition.push({} as CanvasImageSource);
    first.tools.brush = 40;
    first.things.push({} as never);

    expect(second.view.angle).toBe(0);
    expect(second.view.canvas.width).toBe(0);
    expect(second.layers.backgroundKey.src).toBeUndefined();
    expect(second.layers.composition).toEqual([]);
    expect(second.tools.brush).toBe(MIN_BRUSH);
    expect(second.things).toEqual([]);
  });
});
