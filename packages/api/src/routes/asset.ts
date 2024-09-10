import { log } from "../utils/logger";
import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import { createUserAsset } from "../utils/asset";

export async function createAsset(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // don't 401 on a non-existant user -- create them (their token has validated)
  try {
    const user = await getOrCreateUser(req.auth);
    const result = createUserAsset(user, req.body);
    res.json(result);
  } catch (err) {
    log.error("Unable to create asset", err);
    return next({ status: err.cause || 500 });
  }
}
