import { Request } from "express";
import { cp, rm } from "node:fs/promises";

import { log } from "./logger";
import {
  CONTENT_TYPE_EXTS,
  DEST_FOLDER,
  VALID_CONTENT_TYPES,
} from "./constants";
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
  const dest = `${DEST_FOLDER}/${user._id}/assets/${name}.${ext}`;

  // do not catch (let exception through)
  await copyAndDelete(file.path, dest);
  return dest;
}

async function copyAndDelete(src: string, dest: string) {
  // log.info(`Copying ${src} to ${dest}`);
  try {
    await cp(src, dest, { force: true, preserveTimestamps: true });
  } catch (err) {
    const msg = `Error copying ${src} to ${dest}`;
    log.error(msg, err);
    throw new Error(msg, { cause: 500 });
  }

  try {
    // log.info(`Deleting ${src}`);
    await rm(src, { force: true });
  } catch (err) {
    log.error(`Unable to delete ${src}`, err);
  }
}

export async function updateAssetFromUpload(
  scene: IScene,
  layer: string,
  req: Request,
): Promise<LayerUpdate> {
  const ext = getContentTypeExtension(req.file.mimetype);
  if (!ext)
    throw new Error(`Invalid mime type: ${req.file.mimetype}`, { cause: 406 });
  const src = req.file.path;
  const fileName = `${layer}.${ext}`;
  const dest = `${DEST_FOLDER}/${scene.user}/scene/${scene._id}/${fileName}`;

  // do not catch (let exception through)
  await copyAndDelete(src, dest);

  return {
    id: scene._id.toString(),
    layer: layer,
    path: dest,
  };
}

export async function deleteAssetFile(path: string) {
  return rm(path, { force: true });
}
