import { log } from "../utils/logger";
import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import { createUserAsset, getUserAsset, listUserAssets } from "../utils/asset";
import { getValidExtension, updateAssetFromFile } from "../utils/localstore";

export async function listAssets(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const assets = await listUserAssets(user);
    res.json(assets);
  } catch (err) {
    log.error("Unable to list user assets", err);
    return next({ status: err.cause || 500 });
  }
}
export async function createAsset(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const asset = await createUserAsset(user, req.body);
    res.json(asset);
  } catch (err) {
    log.error(`Unable to create asset: ${err.message}`);
    return next({ status: err.cause || 500 });
  }
}

export async function setAssetData(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // validator doesn't handle multer bits
    if (!("file" in req)) {
      return res.sendStatus(400);
    }

    const user = await getOrCreateUser(req.auth);

    // this throws an exception with a cause if the extension is not supported... just let it through
    const ext = getValidExtension(req.file);

    // create or retrieve the asset
    const asset = await getUserAsset(user, req.params.id);
    if (!asset) {
      throw new Error("No asset", { cause: 404 });
    }

    // if there is an image upload, handle it
    const dest = await updateAssetFromFile(
      user,
      req.file,
      asset._id.toString(),
      ext,
    );

    // update the asset with the location
    asset.location = dest;
    const result = await asset.save();

    res.json(result);
  } catch (err) {
    log.error("Unable to create asset", err);
    return next({ status: err.cause || 500 });
  }
}
