import { knownMongoError } from "../src/utils/errors";

class FakeMongoError extends Error {
  code: number;
  constructor(code: number) {
    super();
    this.name = "MongoServerError";
    this.code = code;
  }
}

describe("knownMongoError", () => {
  it("should ignore a normal error", async () => {
    expect(knownMongoError(new Error())).toBe(false);
  });

  it("should ignore a mongo error with a different code", async () => {
    expect(knownMongoError(new FakeMongoError(1234))).toBe(false);
  });

  it("should raise a 409 exception without next", async () => {
    try {
      knownMongoError(new FakeMongoError(11000));
      fail("Should have thrown an exception");
    } catch (err) {
      expect(err.cause).toBe(409);
    }
  });

  it("should call next with a 409 status", async () => {
    const next = jest.fn();
    knownMongoError(new FakeMongoError(11000), next);
    expect(next).toHaveBeenCalledWith({ status: 409 });
  });
});
