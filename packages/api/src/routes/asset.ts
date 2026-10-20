import { log } from "../utils/logger";
import { NextFunction, Request, Response } from "express";
import { getOrCreateUser } from "../utils/user";
import {
  assetInUse,
  assetUsage,
  createUserAsset,
  getUserAsset,
  getUserAssetWithStaging,
  listUserAssets,
  renameUserAsset,
  serializeAsset,
  serializeAssets,
} from "../utils/asset";
import {
  commitAssetData,
  deleteAssetFile,
  presignAssetUpload,
} from "../utils/assetstore";
import {
  createDownloadUrl,
  deleteObject,
  locationToKey,
} from "../utils/s3store";
import { errorMessage, errorStatus, knownMongoError } from "../utils/errors";

export async function listAssets(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const assets = await listUserAssets(user);
    res.json(await serializeAssets(assets));
  } catch (err) {
    log.error("Unable to list user assets", err);
    return next({ status: errorStatus(err) });
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
    return res.json(await serializeAsset(asset));
  } catch (err) {
    log.error("Unable to fetch user asset", err);
    return next({ status: errorStatus(err) });
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
      const created = await createUserAsset(user, req.body);
      if (!created) {
        throw new Error("Unable to create asset", { cause: 500 });
      }
      return res.status(201).json(await serializeAsset(created));
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
    return res.json(await serializeAsset(renamed));
  } catch (err) {
    if (knownMongoError(err, next)) return;
    log.error(`Unable to create asset: ${errorMessage(err)}`);
    return next({ status: errorStatus(err) });
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
    return next({ status: errorStatus(err) });
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
    const asset = await getUserAssetWithStaging(user, req.params.id);
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
    log.error(`Error deleting asset ${errorMessage(err)}`);
    return next({ status: errorStatus(err) });
  }
  try {
    if (path) await deleteAssetFile(path);
  } catch (err) {
    log.error(`Unable to delete asset file ${errorMessage(err)}`);
  }
  // an incomplete asset may still have a staged (uncommitted) upload
  try {
    if (staging) await deleteObject(staging);
  } catch (err) {
    log.error(`Unable to delete staged upload ${errorMessage(err)}`);
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
    const asset = await getUserAssetWithStaging(user, req.params.id);
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
    return next({ status: errorStatus(err) });
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

    // retrieve the asset (with staging location)
    const asset = await getUserAssetWithStaging(user, req.params.id);
    if (!asset) {
      throw new Error("No asset", { cause: 404 });
    }

    // assets are immutable once their data is uploaded -- replacing the
    // image would silently invalidate token placement and scene viewports.
    // the scene overlay endpoint is the only sanctioned replacement path
    if (asset.location) {
      throw new Error("Asset data cannot be replaced", { cause: 409 });
    }

    const committed = await commitAssetData(user, asset, req.body.contentType);
    return res.json(await serializeAsset(committed));
  } catch (err) {
    log.error("Unable to create asset", err);
    return next({ status: errorStatus(err) });
  }
}

/**
 * Mint fresh presigned download urls for a batch of the caller's asset
 * locations. Presigned urls are short-lived, so a client whose fetch failed
 * with 403 (expired signature) can use this to refresh the urls it needs
 * without refetching the asset metadata.
 *
 * Every requested location must belong to the calling user; locations are
 * validated with the same rules the storage layer uses everywhere else
 * (this also rejects path traversal).
 */
export async function createAssetDownloadUrls(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getOrCreateUser(req.auth);
    const locations = req.body.locations as string[];

    const urls: Record<string, string> = {};
    await Promise.all(
      [...new Set(locations)].map(async (location) => {
        const key = locationToKey(location);
        if (!key.startsWith(`${user._id.toString()}/`)) {
          throw new Error("Forbidden location", { cause: 403 });
        }
        urls[location] = await createDownloadUrl(key);
      }),
    );

    return res.json({ urls });
  } catch (err) {
    log.error("Unable to create asset download urls", err);
    return next({ status: errorStatus(err) });
  }
}
