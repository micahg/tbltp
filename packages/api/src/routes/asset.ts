import { log } from "../utils/logger";
import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import { createUserAsset, getUserAsset, listUserAssets } from "../utils/asset";
import {
  deleteAssetFile,
  getValidExtension,
  updateAssetFromFile,
} from "../utils/localstore";

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
export async function createOrUpdateAsset(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    if (!req.body._id) {
      return res.status(201).json(await createUserAsset(user, req.body));
    }
    let updated = false;
    const asset = await getUserAsset(user, req.body._id);
    if (asset.name != req.body.name) {
      asset.name = req.body.name;
      updated = true;
    }
    if (updated) {
      return res.json(await asset.save());
    }
    return res.status(204).send();
  } catch (err) {
    if ("name" in err && err.name === "MongoServerError") {
      if (err.code === 11000) {
        return next({ status: 409 });
      }
    }
    log.error(`Unable to create asset: ${err.message}`);
    return next({ status: err.cause || 500 });
  }
}
export async function deleteAsset(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let path;
  try {
    const user = await getOrCreateUser(req.auth);
    const asset = await getUserAsset(user, req.params.id);
    if (!asset) {
      return res.status(404).send();
    }
    await asset.deleteOne();
    path = asset.location;
    // don't return yet, we will delete after sending the response
    res.status(204).send();
  } catch (err) {
    log.error(`Unable to delete asset ${err.message}`);
    return next({ status: err.cause || 500 });
  }
  try {
    if (path) await deleteAssetFile(path);
  } catch (err) {
    log.error(`Unable to delete asset file ${err.message}`);
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
    asset.revision = asset.revision + 1;
    const result = await asset.save();

    res.json(result);
  } catch (err) {
    log.error("Unable to create asset", err);
    return next({ status: err.cause || 500 });
  }
}
