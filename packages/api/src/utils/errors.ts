import { NextFunction } from "express";

const MongoStatusMap: { [key: number]: number } = {
  11000: 409,
};

/**
 * Caught values are `unknown` (so are errors from third-party code); our
 * convention is to convey a status/code with `new Error(msg, { cause })`.
 */
export function errorCause(err: unknown): unknown {
  return err instanceof Error ? err.cause : undefined;
}

/**
 * HTTP status from an error's `cause`, defaulting to 500. Preserves the
 * `err.cause || 500` pattern the routes used before catch variables became
 * `unknown`.
 */
export function errorStatus(err: unknown): number {
  const cause = errorCause(err);
  return typeof cause === "number" && cause ? cause : 500;
}

/** Best-effort message for a caught value, safe to use in logs. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

export function knownMongoError(err: unknown, next?: NextFunction): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { name, code } = err as { name?: unknown; code?: unknown };
  if (name !== "MongoServerError") return false;
  if (typeof code !== "number") return false;
  const status = MongoStatusMap[code];
  if (status === undefined) return false;
  if (next === undefined) {
    throw new Error("Already exists", { cause: status });
  }
  next({ status: status });
  return true;
}
