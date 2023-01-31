import { calculateBounds } from "./geometry";

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