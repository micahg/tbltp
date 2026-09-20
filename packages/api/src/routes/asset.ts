import { log } from "../utils/logger";
import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import {
  assetInUse,
  assetUsage,
  createUserAsset,
  getUserAsset,
  listUserAssets,
} from "../utils/asset";
import {
  deleteAssetFile,
  buildAssetLocation,
  getValidExtension,
} from "../utils/assetstore";
import { createUploadUrl, locationToKey, objectExists } from "../utils/s3store";
import { knownMongoError } from "../utils/errors";

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

export async function getAssetById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const asset = await getUserAsset(user, req.params.id);
    if (!asset) {
      return res.sendStatus(404);
    }
    return res.json(asset);
  } catch (err) {
    log.error("Unable to fetch user asset", err);
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
    if (knownMongoError(err, next)) return;
    log.error(`Unable to create asset: ${err.message}`);
    return next({ status: err.cause || 500 });
  }
}
export async function getAssetUsage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const asset = await getUserAsset(user, req.params.id);
    if (!asset) {
      return res.sendStatus(404);
    }
    return res.json(await assetUsage(user, asset));
  } catch (err) {
    log.error("Unable to get asset usage", err);
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
    if (await assetInUse(user, asset)) {
      throw new Error("Asset in use", { cause: 409 });
    }
    await asset.deleteOne();
    path = asset.location;
    // don't return yet, we will delete after sending the response
    res.status(204).send();
  } catch (err) {
    log.error(`Error deleting asset ${err.message}`);
    return next({ status: err.cause || 500 });
  }
  try {
    if (path) await deleteAssetFile(path);
  } catch (err) {
    log.error(`Unable to delete asset file ${err.message}`);
  }
}

/**
 * Issue a presigned URL the client can use to upload the asset data directly
 * to object storage.
 */
export async function createAssetUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const asset = await getUserAsset(user, req.params.id);
    if (!asset) {
      throw new Error("No asset", { cause: 404 });
    }

    // this throws an exception with a cause if the extension is not supported... just let it through
    const ext = getValidExtension(req.body.contentType);

    const location = buildAssetLocation(user, asset._id.toString(), ext);

    const url = await createUploadUrl(
      locationToKey(location),
      req.body.contentType,
    );
    return res.json({ url, location });
  } catch (err) {
    log.error("Unable to create asset upload url", err);
    return next({ status: err.cause || 500 });
  }
}

/**
 * Commit an upload: verify the object landed in storage, then update the
 * asset with its location and bump the revision.
 */
export async function setAssetData(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);

    // this throws an exception with a cause if the extension is not supported... just let it through
    const ext = getValidExtension(req.body.contentType);

    // retrieve the asset
    const asset = await getUserAsset(user, req.params.id);
    if (!asset) {
      throw new Error("No asset", { cause: 404 });
    }

    const location = buildAssetLocation(user, asset._id.toString(), ext);

    if (!(await objectExists(locationToKey(location)))) {
      throw new Error("Upload not completed", { cause: 400 });
    }

    // update the asset with the location
    asset.location = location;
    asset.revision = asset.revision + 1;
    const result = await asset.save();

    res.json(result);
  } catch (err) {
    log.error("Unable to create asset", err);
    return next({ status: err.cause || 500 });
  }
}
