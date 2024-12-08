import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import { log } from "../utils/logger";
import { createUserToken, getUserToken } from "../utils/token";
import { getUserAsset } from "../utils/asset";

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
      }
      if (updated) {
        return res.json(await token.save()).send(204);
      }
      return res.status(204).send();
    }
    const retval = await createUserToken(user, req.body);
    return res.status(201).json(retval);
  } catch (err) {
    log.error(`Unable to create asset: ${err.message}`);
    return next({ status: err.cause || 500 });
  }
}
