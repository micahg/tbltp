import { IUser } from "../models/user";
import { CONTENT_TYPE_EXTS, VALID_CONTENT_TYPES } from "./constants";
import { deletePublicAsset, putPublicAssetFromUpload } from "./storage";

export function getValidExtension(file: Express.Multer.File) {
  const idx = VALID_CONTENT_TYPES.indexOf(file.mimetype);
  if (idx === -1)
    throw new Error(`Invalid mime type: ${file.mimetype}`, { cause: 406 });
  return CONTENT_TYPE_EXTS[idx];
}

export async function updateAssetFromFile(
  user: IUser,
  filePath: string,
  name: string,
  ext: string,
) {
  const key = `${user._id}/assets/${name}.${ext}`;
  return putPublicAssetFromUpload(filePath, key, ext);
}

export async function deleteAssetFile(path: string) {
  return deletePublicAsset(path);
}
