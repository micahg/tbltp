/**
 * @jest-environment jsdom
 */

import {
  Rect,
  calculateBounds,
  rotatedWidthAndHeight,
  rotateBackToBackgroundOrientation,
  fillRotatedViewport,
  normalizeRect,
  createRect,
  Point,
} from "../src/utils/geometry";

describe("Geometry", () => {
  describe("Rotation", () => {
    it("Should rotate a points back to the origin of the prerotated width", () => {
      let p: Point;
      p = rotateBackToBackgroundOrientation(-90, 0, 4, 2, 4, 4, 2);
      expect(p.x).toBe(4);
      expect(p.y).toBe(2);
      p = rotateBackToBackgroundOrientation(-180, 0, 4, 2, 4, 2, 4);
      expect(p.x).toBe(2);
      expect(p.y).toBe(0);
      p = rotateBackToBackgroundOrientation(-270, 0, 2, 4, 2, 2, 4);
      expect(p.x).toBe(0);
      expect(p.y).toBe(0);
      //1343,712
      p = rotateBackToBackgroundOrientation(-270, 0, 712, 1343, 712, 712, 1343);
      expect(p.x).toBe(0);
      expect(p.y).toBe(0);
    });
  });

  describe("Calculate Bounds", () => {
    it("Should handle a perfect fit", () => {
      const result = calculateBounds(10, 10, 10, 10);
      expect(result.y).toEqual(0);
      expect(result.x).toEqual(0);
      expect(result.width).toEqual(10);
      expect(result.height).toEqual(10);
    });

    it("Should handle a wide display/wide image", () => {
      const result = calculateBounds(20, 10, 10, 5);
      expect(result.y).toEqual(0);
      expect(result.x).toEqual(0);
      expect(result.width).toEqual(20);
      expect(result.height).toEqual(10);
    });

    it("Should handle wide display with larger aspect height but wide image", () => {
      const result = calculateBounds(20, 10, 10, 8);
      expect(result.x).toEqual(4);
      expect(result.y).toEqual(0);
      expect(result.width).toEqual(13);
      expect(result.height).toEqual(10);
    });

    it("Should handle wide display with smaller aspect height but wide image", () => {
      const result = calculateBounds(20, 10, 10, 4);
      expect(result.x).toEqual(0);
      expect(result.y).toEqual(1);
      expect(result.width).toEqual(20);
      expect(result.height).toEqual(8);
    });

    it("Should handle wide display with a larger wide image with a smaller aspect height but wide image", () => {
      const result = calculateBounds(20, 10, 30, 12);
      expect(result.x).toEqual(0);
      expect(result.y).toEqual(1);
      expect(result.width).toEqual(20);
      expect(result.height).toEqual(8);
    });

    it("Brain Melting", () => {
      const result = calculateBounds(1422, 647, 4160, 2008);
      expect(result.x).toEqual(41);
      expect(result.y).toEqual(0);
      expect(result.width).toEqual(1340);
      expect(result.height).toEqual(647);
    });

    it("Brain Melting 2", () => {
      const result = calculateBounds(1422, 647, 5200, 2008);
      expect(result.x).toEqual(0);
      expect(result.y).toEqual(49);
      expect(result.width).toEqual(1422);
      expect(result.height).toEqual(549);
    });
  });

  describe("Fill to Aspect Ratio", () => {
    beforeAll(() => {
      global.innerWidth = 960;
      global.innerHeight = 540;
      jest
        .spyOn(document.documentElement, "clientWidth", "get")
        .mockImplementation(() => global.innerWidth);
      jest
        .spyOn(document.documentElement, "clientHeight", "get")
        .mockImplementation(() => global.innerHeight);
      jest
        .spyOn(document.documentElement, "offsetWidth", "get")
        .mockImplementation(() => global.innerWidth);
      jest
        .spyOn(document.documentElement, "offsetHeight", "get")
        .mockImplementation(() => global.innerHeight);
    });

    it("Should figure out the rotated width and height", () => {
      let [x, y] = rotatedWidthAndHeight(90, 2, 4);
      expect(x).toBe(4);
      expect(y).toBe(2);
      [x, y] = rotatedWidthAndHeight(180, 2, 4);
      expect(x).toBe(2);
      expect(y).toBe(4);
      [x, y] = rotatedWidthAndHeight(270, 2, 4);
      expect(x).toBe(4);
      expect(y).toBe(2);
      [x, y] = rotatedWidthAndHeight(360, 2, 4);
      expect(x).toBe(2);
      expect(y).toBe(4);
    });
  });

  describe("Rotate and Fill Viewport", () => {
    it("Should rotate and fill the viewport horizontally", () => {
      const screen = [960, 540];
      const image = [2008, 4160];
      const angle = 90;
      const viewport = { x: 100, y: 100, width: 100, height: 100 };
      const result = fillRotatedViewport(screen, image, image, angle, viewport);
      expect(result.width).toBe(100);
      expect(result.height).toBe(178);
      expect(result.x).toBe(100);
      expect(result.y).toBe(61);
    });

    it("Should rotate and fill the viewport", () => {
      const screen = [960, 540];
      const image = [2008, 4160];
      const angle = 90;
      const viewport = { x: 100, y: 100, width: 100, height: 10 };
      const result = fillRotatedViewport(screen, image, image, angle, viewport);
      expect(result.width).toBe(100);
      expect(result.height).toBe(178);
      expect(result.x).toBe(100);
      expect(result.y).toBe(16);
    });

    it("BRAIN MELTING", () => {
      const screen = [1420, 641];
      const image = [2008, 4160];
      const angle = 90;
      const viewport = { x: 300, y: 1294, width: 72, height: 448 };
      const result = fillRotatedViewport(screen, image, image, angle, viewport);
      expect(result.width).toBe(202);
      expect(result.height).toBe(448);
      expect(result.x).toBe(235);
      expect(result.y).toBe(1294);
    });

    it("should retain viewport when not zoomed", () => {
      const screen = [1420, 642];
      const image = [2888, 1838];
      const angle = 0;
      const viewport = { x: 0, y: 0, width: 2888, height: 1838 };
      const result = fillRotatedViewport(screen, image, image, angle, viewport);
      expect(result.width).toBe(2888);
      expect(result.height).toBe(1838);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe("Normalize rectangles", () => {
    it("should handle negatives width", () => {
      const v = normalizeRect(createRect([2006, 3, -191, 188]));
      expect(v.x).toBe(1815);
      expect(v.y).toBe(3);
      expect(v.width).toBe(191);
      expect(v.height).toBe(188);
    });
    it("should handle negatives height", () => {
      const v = normalizeRect(createRect([1815, 191, 191, -188]));
      expect(v.x).toBe(1815);
      expect(v.y).toBe(3);
      expect(v.width).toBe(191);
      expect(v.height).toBe(188);
    });
    it("should handle negative width and height", () => {
      const v = normalizeRect(createRect([100, 100, -100, -100]));
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
      expect(v.width).toBe(100);
      expect(v.height).toBe(100);
    });
  });
});
