import { log } from "../utils/logger";
import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import { createUserAsset, listUserAssets } from "../utils/asset";
import { getValidExtension, updateAssetFromFile } from "../utils/localstore";
import { Asset } from "@micahg/tbltp-common";

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
    // validator doesn't handle multer bits
    if (!("file" in req)) {
      return res.sendStatus(400);
    }

    const user = await getOrCreateUser(req.auth);
    const asset: Asset = {
      name: req.body.name,
    };

    // this throws an exception with a cause if the extension is not supported... just let it through
    const ext = getValidExtension(req.file);

    const dbAsset = await createUserAsset(user, asset);

    // if there is an image upload, handle it
    const dest = await updateAssetFromFile(
      user,
      req.file,
      dbAsset._id.toString(),
      ext,
    );

    // update the asset with the location
    dbAsset.location = dest;
    const result = await dbAsset.save();

    res.json(result);
  } catch (err) {
    log.error("Unable to create asset", err);
    return next({ status: err.cause || 500 });
  }
}
