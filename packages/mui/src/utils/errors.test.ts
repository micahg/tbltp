import {
  errorMessageForCreateError,
  errorMessageForDeleteError,
  errorMessageForUpdateError,
  inferStatus,
} from "./errors";

describe("inferStatus", () => {
  test("reads numeric status", () => {
    expect(inferStatus({ status: 409 })).toBe(409);
  });

  test("reads status from message", () => {
    expect(inferStatus(new Error("Upload failed with status 413"))).toBe(413);
  });

  test("returns undefined without a status", () => {
    expect(inferStatus(new Error("nope"))).toBeUndefined();
    expect(inferStatus(undefined)).toBeUndefined();
    expect(inferStatus("string error")).toBeUndefined();
  });
});

describe("errorMessageForCreateError", () => {
  test("maps duplicate name conflict", () => {
    expect(errorMessageForCreateError({ status: 409 })).toBe(
      "Name already exists",
    );
  });

  test("maps upload failures", () => {
    expect(errorMessageForCreateError({ status: 413 })).toBe("Asset too big");
    expect(errorMessageForCreateError({ status: 406 })).toBe(
      "Invalid asset format",
    );
  });

  test("falls back to a generic message", () => {
    expect(errorMessageForCreateError({ status: 500 })).toBe(
      "Unknown error happened",
    );
  });
});

describe("errorMessageForUpdateError", () => {
  test("shares the create mappings", () => {
    expect(errorMessageForUpdateError({ status: 409 })).toBe(
      "Name already exists",
    );
    expect(errorMessageForUpdateError({ status: 413 })).toBe("Asset too big");
  });
});

describe("errorMessageForDeleteError", () => {
  test("maps conflict to in-use", () => {
    expect(errorMessageForDeleteError({ status: 409 })).toBe("Asset in use");
  });

  test("falls back to a generic message", () => {
    expect(errorMessageForDeleteError({ status: 500 })).toBe(
      "Unknown error happened",
    );
  });
});
