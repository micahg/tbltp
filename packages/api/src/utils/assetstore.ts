import { HydratedDocument } from "mongoose";
import { IUser } from "../models/user";
import { IAsset } from "../models/asset";
import { CONTENT_TYPE_EXTS, VALID_CONTENT_TYPES } from "./constants";
import {
  createUploadUrl,
  deletePublicAsset,
  ensurePublicLocation,
  locationToKey,
  objectExists,
} from "./s3store";

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

export async function deleteAssetFile(path: string) {
  return deletePublicAsset(path);
}

/**
 * Issue a presigned upload url for an asset's data location. Shared by the
 * asset data routes and the scene overlay routes.
 *
 * @param user The user who owns the asset.
 * @param asset The asset being uploaded to.
 * @param contentType The content type of the upload (validated).
 * @returns A promise resolving to the presigned url and the location it
 * targets.
 */
export async function presignAssetUpload(
  user: IUser,
  asset: IAsset,
  contentType: string,
): Promise<{ url: string; location: string }> {
  // this throws an exception with a cause if the extension is not supported
  const ext = getValidExtension(contentType);

  const location = buildAssetLocation(user, asset._id!.toString(), ext);

  const url = await createUploadUrl(locationToKey(location), contentType);
  return { url, location };
}

/**
 * Commit an upload: verify the object landed in storage, then record the
 * location and bump the revision. Shared by the asset data routes and the
 * scene overlay routes.
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

  // the location is not carried on the asset, it is derived from the asset
  // id and the extension of the upload being committed
  const location = buildAssetLocation(user, asset._id!.toString(), ext);

  if (!(await objectExists(locationToKey(location)))) {
    throw new Error("Upload not completed", { cause: 400 });
  }

  asset.location = location;
  asset.revision = (asset.revision || 0) + 1;
  return asset.save();
}
