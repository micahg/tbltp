import { IUser } from "../models/user";
import { CONTENT_TYPE_EXTS, VALID_CONTENT_TYPES } from "./constants";
import { deletePublicAsset, ensurePublicLocation } from "./s3store";

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
