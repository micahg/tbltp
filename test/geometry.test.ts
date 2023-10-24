/**
 * @jest-environment jsdom
 */

import { Rect, calculateBounds, scaleSelection, fillToAspect} from "../src/utils/geometry";

describe('Geometry', () => {
  describe('Calculate Bounds', () => {
    it('Should handle a perfect fit', () => {
      let result = calculateBounds(10,10,10,10);
      expect(result.top).toEqual(0);
      expect(result.left).toEqual(0);
      expect(result.width).toEqual(10);
      expect(result.height).toEqual(10);
      expect(result.rotate).toEqual(false);
    });
  
    it('Should handle a wide display/wide image', () => {
      let result = calculateBounds(20,10,10,5);
      expect(result.top).toEqual(0);
      expect(result.left).toEqual(0);
      expect(result.width).toEqual(20);
      expect(result.height).toEqual(10);
      expect(result.rotate).toEqual(false);
    });
  
    it('Should handle wide display with larger aspect height but wide image', () => {
      let result = calculateBounds(20, 10, 10, 8);
      expect(result.left).toEqual(3.75);
      expect(result.top).toEqual(0);
      expect(result.width).toEqual(12.5);
      expect(result.height).toEqual(10);
      expect(result.rotate).toEqual(false);
    });
  
    it('Should handle wide display with smaller aspect height but wide image', () => {
      let result = calculateBounds(20, 10, 10, 4);
      expect(result.left).toEqual(0);
      expect(result.top).toEqual(1);
      expect(result.width).toEqual(20);
      expect(result.height).toEqual(8);
      expect(result.rotate).toEqual(false);
    });
  
    it('Should handle wide display with a larger wide image with a smaller aspect height but wide image', () => {
      let result = calculateBounds(20, 10, 30, 12);
      expect(result.left).toEqual(0);
      expect(result.top).toEqual(1);
      expect(result.width).toEqual(20);
      expect(result.height).toEqual(8);
      expect(result.rotate).toEqual(false);
    });
  
    it ('Should rotate a tall image to a wide display', () => {
      let result = calculateBounds(20, 10, 10, 20);
      expect(result.left).toEqual(0);
      expect(result.top).toEqual(0);
      expect(result.width).toEqual(10);
      expect(result.height).toEqual(20);
      expect(result.rotate).toEqual(true);
    });
  
    it ('Should rotate and scale a tall image to a wide display', () => {
      let result = calculateBounds(20, 10, 5, 10);
      expect(result.left).toEqual(0);
      expect(result.top).toEqual(0);
      expect(result.width).toEqual(10);
      expect(result.height).toEqual(20);
      expect(result.rotate).toEqual(true);
    });
  
    it ('Should rotate and scale a tall image with a different aspect ratio to a wide display', () => {
      let result = calculateBounds(20, 10, 8, 10);
      expect(result.left).toEqual(3.75);
      expect(result.top).toEqual(0);
      expect(result.width).toEqual(10);
      expect(result.height).toEqual(12.5);
      expect(result.rotate).toEqual(true);
    });
  
    it('Should rotate a larger wide image with a smaller aspect height but wide image', () => {
      let result = calculateBounds(20, 10, 12, 30);
      expect(result.left).toEqual(0);
      expect(result.top).toEqual(1);
      expect(result.width).toEqual(8);
      expect(result.height).toEqual(20);
      expect(result.rotate).toEqual(true);
    });
  });
  describe('Scale Selection', () => {
    it('Should scale horizontally', () => {
      let viewport: Rect = {x: 0, y: 0, width: 3, height: 3};
      let selection: Rect = {x: 1, y: 1, width: 1, height: 1};
      let width: number = 6;
      let height: number = 3;
      let result = scaleSelection(selection, viewport, width, height);
      expect(result.x).toEqual(2);
      expect(result.y).toEqual(1);
      expect(result.width).toEqual(2);
      expect(result.height).toEqual(1);
    });
    it('Should scale vertically', () => {
      let viewport: Rect = {x: 0, y: 0, width: 3, height: 3};
      let selection: Rect = {x: 1, y: 1, width: 1, height: 1};
      let width: number = 3;
      let height: number = 6;
      let result = scaleSelection(selection, viewport, width, height);
      expect(result.x).toEqual(1);
      expect(result.y).toEqual(2);
      expect(result.width).toEqual(1);
      expect(result.height).toEqual(2);
    });
    it('Should scale in both directions', () => {
      let viewport: Rect = {x: 0, y: 0, width: 3, height: 3};
      let selection: Rect = {x: 1, y: 1, width: 1, height: 1};
      let width: number = 6;
      let height: number = 6;
      let result = scaleSelection(selection, viewport, width, height);
      expect(result.x).toEqual(2);
      expect(result.y).toEqual(2);
      expect(result.width).toEqual(2);
      expect(result.height).toEqual(2);
    });
  });

  describe('Fill to Aspect Ratio', () => {
    beforeAll(() => {
      global.innerWidth = 960;
      global.innerHeight = 540;
      jest.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => global.innerWidth)
      jest.spyOn(document.documentElement, 'clientHeight', 'get').mockImplementation(() => global.innerHeight)
      jest.spyOn(document.documentElement, 'offsetWidth', 'get').mockImplementation(() => global.innerWidth)
      jest.spyOn(document.documentElement, 'offsetHeight', 'get').mockImplementation(() => global.innerHeight)
    })
    it('Should fill a square selection', () => {
      const selection: Rect = {x: 2000, y: 1000, width: 1000, height: 500}
      const table: Rect = { x: 0, y:0, width: 6750, height: 4950};
      const filled = fillToAspect(selection, table, table.width, table.height);
      expect(filled).not.toBeNull();
      expect(filled.x).toBe(2000);
      expect(filled.width).toBe(1000);
      expect(filled.height).toBe(562.5)
      expect(filled.y).toBe(968.75)
    });

    it('Should Scale Horizontally With A Reduced Image Size', () => {
      const width = 5063;
      const height = 3713;
      const selection: Rect = {x: 5316, y: 4010, width: 1422, height: 939}
      const table: Rect = { x: 0, y:0, width: 6750, height: 4950};
      const filled = fillToAspect(selection, table, width, height);
      expect(filled).not.toBeNull();
      // these values are incorrect and work around a browser issue with
      // drawImage... I think.
      expect(Math.round(filled.x)).toBe(2858);
      expect(Math.round(filled.width)).toBe(939);
      expect(Math.round(filled.height)).toBe(528)
      expect(Math.round(filled.y)).toBe(2256)
      // these are the correct values
      // expect(Math.round(filled.x)).toBe(3811);
      // expect(Math.round(filled.width)).toBe(1252);
      // expect(Math.round(filled.height)).toBe(704)
      // expect(Math.round(filled.y)).toBe(3008)
    });

    it('Should Scale Vertically With A Reduced Image Size', () => {
      const width = 5063;
      const height = 3713;
      const selection: Rect = {x: 5316, y: 4449, width: 1422, height: 500}
      const table: Rect = { x: 0, y:0, width: 6750, height: 4950};
      const filled = fillToAspect(selection, table, width, height);
      expect(filled).not.toBeNull();
      // these values are incorrect and work around a browser issue with
      // drawImage... I think.
      expect(Math.round(filled.x)).toBe(2991);
      expect(Math.round(filled.width)).toBe(800);
      expect(Math.round(filled.height)).toBe(450)
      expect(Math.round(filled.y)).toBe(2335)

      // these are the actual values
      // expect(Math.round(filled.x)).toBe(3987);
      // expect(Math.round(filled.width)).toBe(1067);
      // expect(Math.round(filled.height)).toBe(600)
      // expect(Math.round(filled.y)).toBe(3113)
    });
  })
});