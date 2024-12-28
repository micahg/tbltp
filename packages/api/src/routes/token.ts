import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import { log } from "../utils/logger";
import { createUserToken, getUserToken, listUserTokens } from "../utils/token";
import { getUserAsset } from "../utils/asset";
import { knownMongoError } from "../utils/errors";

export async function listTokens(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const tokens = await listUserTokens(user);
    res.json(tokens);
  } catch (err) {
    log.error("Unable to list user assets", err);
    return next({ status: err.cause || 500 });
  }
}

export async function createOrUpdateToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const withAsset = !!req.body.asset;
    const user = await getOrCreateUser(req.auth);
    const asset = withAsset ? await getUserAsset(user, req.body.asset) : null;

    // MAKE SURE THEY'RE USING THEIR ASSET (and that it exists)
    if (withAsset && !asset) {
      log.error(`Unable to find asset: ${req.body.asset}`);
      return next({ status: 400 });
    }

    if ("_id" in req.body) {
      let updated = false;
      const token = await getUserToken(user, req.body._id);

      const hadAsset = !!token.asset;

      if (token.name != req.body.name) {
        token.name = req.body.name;
        updated = true;
      }
      if (token.hitPoints != req.body.hitPoints) {
        token.hitPoints = req.body.hitPoints;
        updated = true;
      }
      if (token.visible != req.body.visible) {
        token.visible = req.body.visible;
        updated = true;
      }

      if (withAsset) {
        token.asset = asset._id;
        updated = true;
      } else if (hadAsset) {
        // asset explicitly unset
        token.asset = undefined;
        updated = true;
      }

      if (updated) {
        return res.json(await token.save());
      }
      return res.status(204).send();
    }
    const retval = await createUserToken(user, req.body);
    return res.status(201).json(retval);
  } catch (err) {
    if (knownMongoError(err, next)) return;
    log.error(`Unable to create asset: ${err.message}`);
    return next({ status: err.cause || 500 });
  }
}

export async function deleteToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const token = await getUserToken(user, req.params.id);
    if (!token) {
      return res.status(404).send();
    }
    await token.deleteOne();
    // don't return yet, we will delete after sending the response
    return res.status(204).send();
  } catch (err) {
    log.error(`Unable to delete token ${err.message}`);
    return next({ status: err.cause || 500 });
  }
}
