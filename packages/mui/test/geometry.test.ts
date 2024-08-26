/**
 * @jest-environment jsdom
 */

import {
  calculateBounds,
  rotatedWidthAndHeight,
  rotateBackToBackgroundOrientation,
  normalizeRect,
  createRect,
  Point,
  adjustImageToViewport,
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

  describe("Adjust image and viewport to screen and background image size", () => {
    it("Should not extend past the background width", () => {
      const angle = 0;
      const zoom = 0.41371241501522343;
      const [cw, ch] = [2037, 1162];
      const [bw, bh] = [2888, 1839];
      const vp = { x: 0, y: 0, width: 0, height: 0 };
      const img = { x: 2773, y: 1341, width: 95, height: 480 };
      adjustImageToViewport(angle, zoom, cw, ch, bw, bh, vp, img);
      expect(vp.x).toBe(0);
      expect(vp.y).toBe(0);
      expect(vp.width).toBe(2037);
      expect(vp.height).toBe(1162);
      expect(img.x).toBe(2045);
      expect(img.y).toBe(1341);
      expect(img.width).toBe(843);
      expect(img.height).toBe(481);
      return;
    });
    it("Should extend before 0,0", () => {
      const angle = 90;
      const zoom = 0.3603392688134574;
      const [cw, ch] = [2037, 1162];
      const [bw, bh] = [2888, 1839];
      const vp = { x: 0, y: 0, width: 0, height: 0 };
      const img = { x: 16, y: 1097, width: 27, height: 734 };
      adjustImageToViewport(angle, zoom, cw, ch, bw, bh, vp, img);
      expect(vp.x).toBe(0);
      expect(vp.y).toBe(0);
      expect(vp.width).toBe(1162);
      expect(vp.height).toBe(2037);
      expect(img.x).toBe(0);
      expect(img.y).toBe(1097);
      expect(img.width).toBe(419);
      expect(img.height).toBe(734);
      return;
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
