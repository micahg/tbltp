import * as drawing from "../src/utils/drawing";
import { Drawable, DrawableToken } from "../src/utils/drawing";
import {
  renderThings,
  thingAt,
  updateThings,
} from "../src/utils/contentworker/things";

type FakeContext = {
  canvas: { width: number; height: number };
  clearRect: jest.Mock;
  save: jest.Mock;
  restore: jest.Mock;
};

function makeContext(): FakeContext {
  return {
    canvas: { width: 100, height: 50 },
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
  };
}

function makeDrawable(contains = false): Drawable {
  return {
    token: {},
    contains: jest.fn(() => contains),
    draw: jest.fn(),
    setOpacity: jest.fn(),
  } as unknown as Drawable;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("content worker things", () => {
  describe("updateThings", () => {
    it("clears the list when no things are provided", async () => {
      const current = [makeDrawable()];

      await updateThings(current, undefined);

      expect(current).toEqual([]);
    });

    it("filters falsy things and replaces the current list", async () => {
      const first = makeDrawable();
      const second = makeDrawable();
      jest
        .spyOn(drawing, "createDrawable")
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second);
      const current = [makeDrawable()];

      await updateThings(current, [undefined, "first", "second"]);

      expect(current).toEqual([first, second]);
    });

    it("leaves the list empty and logs when a drawable fails to load", async () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      jest
        .spyOn(drawing, "createDrawable")
        .mockRejectedValueOnce(new Error("boom"));
      const current = [makeDrawable()];

      await updateThings(current, ["bad"]);

      expect(current).toEqual([]);
      expect(error).toHaveBeenCalled();
    });
  });

  describe("renderThings", () => {
    it("clears and draws every thing", () => {
      const ctx = makeContext();
      const first = makeDrawable();
      const second = makeDrawable();

      renderThings(
        ctx as unknown as OffscreenCanvasRenderingContext2D,
        [first, second],
      );

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 50);
      expect(first.draw).toHaveBeenCalledWith(ctx);
      expect(second.draw).toHaveBeenCalledWith(ctx);
      expect(ctx.save).toHaveBeenCalledTimes(2);
      expect(ctx.restore).toHaveBeenCalledTimes(2);
    });

    it("does nothing without a context", () => {
      const thing = makeDrawable();

      renderThings(undefined, [thing]);

      expect(thing.draw).not.toHaveBeenCalled();
    });

    it("continues after a thing throws while drawing", () => {
      const ctx = makeContext();
      const bad = makeDrawable();
      const good = makeDrawable();
      bad.draw = jest.fn(() => {
        throw new Error("draw failed");
      });
      const error = jest.spyOn(console, "error").mockImplementation(() => {});

      renderThings(
        ctx as unknown as OffscreenCanvasRenderingContext2D,
        [bad, good],
      );

      expect(error).toHaveBeenCalled();
      expect(good.draw).toHaveBeenCalledWith(ctx);
    });
  });

  describe("thingAt", () => {
    it("returns the first matching drawable and reports containment", () => {
      const first = makeDrawable(false);
      const second = makeDrawable(true);
      const third = makeDrawable(true);
      const contained = jest.fn();
      const notContained = jest.fn();

      const index = thingAt(
        [first, second, third],
        { x: 1, y: 2 },
        DrawableToken,
        contained,
        notContained,
      );

      expect(index).toBe(1);
      expect(contained).toHaveBeenCalledWith(second);
      expect(notContained).toHaveBeenCalledWith(first);
      // Once a match is found, later containing things are reported as
      // not-contained so callers can clear their hover styling.
      expect(notContained).toHaveBeenCalledWith(third);
    });

    it("skips drawables that do not match the requested type", () => {
      const selectedRegion = {
        rect: {},
        contains: jest.fn(() => true),
        draw: jest.fn(),
        setOpacity: jest.fn(),
      } as unknown as Drawable;
      const token = makeDrawable(true);

      const index = thingAt(
        [selectedRegion, token],
        { x: 1, y: 2 },
        DrawableToken,
      );

      expect(index).toBe(1);
      expect(selectedRegion.contains).not.toHaveBeenCalled();
    });

    it("returns -1 when nothing contains the point", () => {
      const first = makeDrawable(false);
      const second = makeDrawable(false);

      expect(thingAt([first, second], { x: 1, y: 2 })).toBe(-1);
    });
  });
});
