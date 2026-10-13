import { log } from "../utils/logger";
import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import {
  assetInUse,
  assetUsage,
  createUserAsset,
  getUserAsset,
  getUserWireAsset,
  listUserAssets,
  renameUserAsset,
} from "../utils/asset";
import {
  commitAssetData,
  deleteAssetFile,
  presignAssetUpload,
} from "../utils/assetstore";
import { deleteObject } from "../utils/s3store";
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
    // wire projection -- database-only fields never reach the wire
    const asset = await getUserWireAsset(user, req.params.id);
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
    const asset = await getUserAsset(user, req.body._id);
    if (!asset) {
      throw new Error("No asset", { cause: 404 });
    }
    if (asset.name === req.body.name) {
      return res.status(204).send();
    }
    // atomic + projected: cannot clobber concurrent updates and cannot
    // leak database-only fields
    const renamed = await renameUserAsset(user, req.body._id, req.body.name);
    if (!renamed) {
      throw new Error("No asset", { cause: 404 });
    }
    return res.json(renamed);
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
  let staging;
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
    staging = asset.staging;
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
  // an incomplete asset may still have a staged (uncommitted) upload
  try {
    if (staging) await deleteObject(staging);
  } catch (err) {
    log.error(`Unable to delete staged upload ${err.message}`);
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

    // assets are immutable once their data is uploaded -- replacing the
    // image would silently invalidate token placement and scene viewports.
    // the scene overlay endpoint is the only sanctioned replacement path
    if (asset.location) {
      throw new Error("Asset data cannot be replaced", { cause: 409 });
    }

    return res.json(
      await presignAssetUpload(user, asset, req.body.contentType),
    );
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

    // retrieve the asset
    const asset = await getUserAsset(user, req.params.id);
    if (!asset) {
      throw new Error("No asset", { cause: 404 });
    }

    // assets are immutable once their data is uploaded -- replacing the
    // image would silently invalidate token placement and scene viewports.
    // the scene overlay endpoint is the only sanctioned replacement path
    if (asset.location) {
      throw new Error("Asset data cannot be replaced", { cause: 409 });
    }

    return res.json(await commitAssetData(user, asset, req.body.contentType));
  } catch (err) {
    log.error("Unable to create asset", err);
    return next({ status: err.cause || 500 });
  }
}
