import { NextFunction } from "express";

const MongoStatusMap: { [key: number]: number } = {
  11000: 409,
};

export function knownMongoError(err: Error, next?: NextFunction): boolean {
  if (!("name" in err)) return false;
  if (err.name !== "MongoServerError") return false;
  if (!("code" in err)) return false;
  const code = err.code as number;
  const status = MongoStatusMap[code];
  if (status === undefined) return false;
  if (next === undefined) {
    throw new Error("Already exists", { cause: status });
  }
  next({ status: status });
  return true;
}
