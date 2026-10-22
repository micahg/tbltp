import { createWorkerState } from "../src/utils/contentworker/state";
import {
  adjustZoom,
  adjustZoomFromViewport,
  calculateViewport,
  trimPanning,
  unrotateBox,
  unrotateScaleTranslatePoints,
} from "../src/utils/contentworker/viewport";

function makeView() {
  return createWorkerState().view;
}

describe("content worker viewport", () => {
  describe("trimPanning", () => {
    it("clamps negative image offsets to zero", () => {
      const image = { x: -10, y: -20, width: 500, height: 400 };
      trimPanning(image, 1200, 800);
      expect(image).toEqual({ x: 0, y: 0, width: 500, height: 400 });
    });

    it("clamps an image that extends past the background", () => {
      const image = { x: 900, y: 600, width: 500, height: 400 };
      trimPanning(image, 1200, 800);
      expect(image).toEqual({ x: 700, y: 400, width: 500, height: 400 });
    });

    it("resets panning when the image is larger than the background", () => {
      const image = { x: 100, y: 100, width: 1300, height: 900 };
      trimPanning(image, 1200, 800);
      expect(image).toEqual({ x: 0, y: 0, width: 1300, height: 900 });
    });
  });

  describe("calculateViewport", () => {
    it("updates the viewport and image from the zoom and background size", () => {
      const view = makeView();
      view.canvas = { x: 0, y: 0, width: 800, height: 600 };
      view.angle = 0;
      view.zoom = 0.75;

      calculateViewport(view, 1200, 800);

      expect(view.viewport).toEqual({ x: 0, y: 0, width: 800, height: 600 });
      expect(view.image).toEqual({ x: 0, y: 0, width: 600, height: 450 });
    });

    it("does nothing until a zoom has been established", () => {
      const view = makeView();
      view.canvas = { x: 0, y: 0, width: 800, height: 600 };
      view.zoom = undefined;

      calculateViewport(view, 1200, 800);

      expect(view.viewport).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      expect(view.image).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe("adjustZoomFromViewport", () => {
    it("copies the requested image and derives the zoom", () => {
      const view = makeView();
      view.canvas = { x: 0, y: 0, width: 800, height: 600 };
      view.angle = 0;
      view.requested = { x: 300, y: 200, width: 600, height: 400 };

      adjustZoomFromViewport(view);

      expect(view.image).toEqual({ x: 300, y: 200, width: 600, height: 400 });
      expect(view.zoom).toBe(0.75);
    });

    it("leaves the view alone when no viewport was requested", () => {
      const view = makeView();
      view.zoom = 2;
      view.image = { x: 10, y: 20, width: 30, height: 40 };
      view.requested = { x: -1, y: -1, width: -1, height: -1 };

      adjustZoomFromViewport(view);

      expect(view.zoom).toBe(2);
      expect(view.image).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    });
  });

  describe("unrotateScaleTranslatePoints", () => {
    it("maps points through the inverse viewport transform", () => {
      const view = makeView();
      view.canvas = { x: 0, y: 0, width: 800, height: 600 };
      view.viewport = { x: 0, y: 0, width: 800, height: 600 };
      view.image = { x: 100, y: 50, width: 600, height: 400 };
      view.angle = 0;
      view.zoom = 0.5;

      const points = unrotateScaleTranslatePoints(view, [
        { x: 0, y: 0 },
        { x: 800, y: 600 },
      ]);

      expect(points).toEqual([
        { x: 100, y: 50 },
        { x: 500, y: 350 },
      ]);
    });
  });

  describe("unrotateBox", () => {
    it("maps a visible selection to the full image", () => {
      const view = makeView();
      view.canvas = { x: 0, y: 0, width: 800, height: 600 };
      view.viewport = { x: 0, y: 0, width: 800, height: 600 };
      view.image = { x: 0, y: 0, width: 1200, height: 900 };
      view.angle = 0;
      view.zoom = 1.5;

      expect(unrotateBox(view, 100, 100, 300, 250)).toEqual([
        150, 150, 300, 225,
      ]);
    });
  });

  describe("adjustZoom", () => {
    it("changes the zoom while keeping the focal point in place", () => {
      const view = makeView();
      view.canvas = { x: 0, y: 0, width: 800, height: 600 };
      view.viewport = { x: 0, y: 0, width: 800, height: 600 };
      view.image = { x: 0, y: 0, width: 1200, height: 900 };
      view.angle = 0;
      view.zoom = 1.5;

      const before = unrotateScaleTranslatePoints(view, [{ x: 400, y: 300 }]);

      adjustZoom(view, 0.75, 400, 300, 1200, 900);

      const after = unrotateScaleTranslatePoints(view, [{ x: 400, y: 300 }]);

      expect(view.zoom).toBe(0.75);
      expect(after).toEqual(before);
      expect(view.image).toEqual({ x: 300, y: 225, width: 600, height: 450 });
    });
  });
});
