import { Request } from "express";
import { CONTENT_TYPE_EXTS, VALID_CONTENT_TYPES } from "./constants";
import { deletePublicAsset, putPublicAssetFromUpload } from "./storage";
import { IScene } from "../models/scene";

import { IUser } from "../models/user";

export interface LayerUpdate {
  id: string;
  layer: string;
  path: string;
}

/**
 * Figure out the destination exension based on mime type
 * @param contentType the content/mime type
 * @returns null if the mime is invalid, otherwise, the extension to use for the mime
 */
function getContentTypeExtension(contentType: string): string | null {
  if (!VALID_CONTENT_TYPES.includes(contentType)) return null;
  return CONTENT_TYPE_EXTS[VALID_CONTENT_TYPES.indexOf(contentType)];
}

export function getValidExtension(file: Express.Multer.File) {
  const idx = VALID_CONTENT_TYPES.indexOf(file.mimetype);
  if (idx === -1)
    throw new Error(`Invalid mime type: ${file.mimetype}`, { cause: 406 });
  return CONTENT_TYPE_EXTS[idx];
}

/**
 * Create or update an asset from an uploaded file
 * @param user the user with a db id
 * @param file the uploaded file
 * @param name the name of the file (should be unique for this user)
 * @param ext the file extension (should be validated first)
 * @returns the destination path of the file
 */
export async function updateAssetFromFile(
  user: IUser,
  file: Express.Multer.File,
  name: string,
  ext: string,
) {
  const key = `${user._id}/assets/${name}.${ext}`;
  return putPublicAssetFromUpload(file.path, key, file.mimetype);
}

export async function updateAssetFromUpload(
  scene: IScene,
  layer: string,
  req: Request,
): Promise<LayerUpdate> {
  const ext = getContentTypeExtension(req.file.mimetype);
  if (!ext)
    throw new Error(`Invalid mime type: ${req.file.mimetype}`, { cause: 406 });
  const fileName = `${layer}.${ext}`;
  const key = `${scene.user}/scene/${scene._id}/${fileName}`;
  const dest = await putPublicAssetFromUpload(
    req.file.path,
    key,
    req.file.mimetype,
  );

  return {
    id: scene._id.toString(),
    layer: layer,
    path: dest,
  };
}

export async function deleteAssetFile(path: string) {
  return deletePublicAsset(path);
}
