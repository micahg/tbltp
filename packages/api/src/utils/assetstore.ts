import { randomUUID } from "node:crypto";
import { HydratedDocument } from "mongoose";
import { IUser } from "../models/user";
import { AssetModel, IAsset } from "../models/asset";
import {
  CONTENT_TYPE_EXTS,
  STAGING_FOLDER,
  VALID_CONTENT_TYPES,
} from "./constants";
import { log } from "./logger";
import {
  copyObject,
  createUploadUrl,
  deleteObject,
  deletePublicAsset,
  ensurePublicLocation,
  locationToKey,
  objectExists,
} from "./s3store";
import { ASSET_FIELDS } from "@micahg/tbltp-common";

export function getValidExtension(contentType: string) {
  const idx = VALID_CONTENT_TYPES.indexOf(contentType);
  if (idx === -1)
    throw new Error(`Invalid mime type: ${contentType}`, { cause: 406 });
  return CONTENT_TYPE_EXTS[idx];
}

export function buildAssetLocation(
  user: IUser,
  assetId: string,
  ext: string,
): string {
  return ensurePublicLocation(`${user._id}/assets/${assetId}.${ext}`);
}

/**
 * Build a fresh single-use staging key. A new key per presign means stale
 * or replayed upload urls can only ever write to garbage nobody reads.
 */
export function buildStagingKey(user: IUser, ext: string): string {
  return `${STAGING_FOLDER}/${user._id.toString()}/${randomUUID()}.${ext}`;
}

export async function deleteAssetFile(path: string) {
  return deletePublicAsset(path);
}

/**
 * Issue a presigned upload url for a fresh single-use staging key, which
 * is recorded on the asset. Shared by the asset data routes and the scene
 * overlay routes.
 *
 * The url never targets the asset's final key -- the bytes are promoted
 * server-side by commitAssetData -- so a url held by a stale tab cannot
 * touch published asset data. Each presign supersedes the previous
 * staging key (deleting the superseded staged object on a best effort
 * basis), so only the most recent presign is committable.
 *
 * @param user The user who owns the asset.
 * @param asset The asset being uploaded to.
 * @param contentType The content type of the upload (validated).
 * @returns A promise resolving to the presigned url and the staging key
 * it targets.
 */
export async function presignAssetUpload(
  user: IUser,
  asset: IAsset,
  contentType: string,
): Promise<{ url: string; location: string }> {
  // this throws an exception with a cause if the extension is not supported
  const ext = getValidExtension(contentType);

  // supersede any in-flight staging key -- a newer presign wins
  if (asset.staging) {
    try {
      await deleteObject(asset.staging);
    } catch (err) {
      // best effort -- the bucket lifecycle rule sweeps what is left
      log.warn(`Unable to delete superseded staging object: ${err}`);
    }
  }

  const stagingKey = buildStagingKey(user, ext);
  const staged = await AssetModel.findOneAndUpdate(
    { _id: { $eq: asset._id }, user: { $eq: user._id } },
    { $set: { staging: stagingKey, stagedAt: new Date() } },
  );
  if (!staged) {
    throw new Error("No asset", { cause: 404 });
  }

  const url = await createUploadUrl(stagingKey, contentType);
  return { url, location: stagingKey };
}

/**
 * Commit an upload: verify the staged object landed in storage, copy it
 * server-side to the asset's final key, delete the staged object, then
 * record the location and bump the revision. Shared by the asset data
 * routes and the scene overlay routes.
 *
 * @param user The user who owns the asset.
 * @param asset The asset (mongoose document) being uploaded to.
 * @param contentType The content type of the upload (validated).
 * @returns A promise resolving to the updated asset.
 */
export async function commitAssetData(
  user: IUser,
  asset: HydratedDocument<IAsset>,
  contentType: string,
): Promise<IAsset> {
  // this throws an exception with a cause if the extension is not supported
  const ext = getValidExtension(contentType);

  // the upload must have been presigned, and the committed content type
  // must match the presigned one (the staging key carries its extension)
  if (!asset.staging) {
    throw new Error("No pending upload", { cause: 400 });
  }
  if (!asset.staging.endsWith(`.${ext}`)) {
    throw new Error("Upload does not match the presigned content type", {
      cause: 400,
    });
  }

  if (!(await objectExists(asset.staging))) {
    throw new Error("Upload not completed", { cause: 400 });
  }

  // the final location is derived from the asset id and the extension of
  // the upload being committed
  const location = buildAssetLocation(user, asset._id!.toString(), ext);
  await copyObject(asset.staging, locationToKey(location));

  // the staged object is garbage once copied -- best effort delete; the
  // bucket lifecycle rule sweeps what is left behind
  try {
    await deleteObject(asset.staging);
  } catch (err) {
    log.warn(`Unable to delete staging object ${asset.staging}: ${err}`);
  }

  const updated = await AssetModel.findOneAndUpdate(
    { _id: { $eq: asset._id }, user: { $eq: user._id } },
    {
      $set: { location: location, revision: (asset.revision || 0) + 1 },
      $unset: { staging: "", stagedAt: "" },
    },
    { new: true },
  ).select(ASSET_FIELDS);
  if (!updated) {
    throw new Error("Unable to record the uploaded asset data", { cause: 500 });
  }
  return updated;
}
