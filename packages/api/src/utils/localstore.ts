import { Request } from "express";
import { createWriteStream } from "node:fs";
import { cp, rm } from "node:fs/promises";

import { IncomingMessage } from "node:http";
import { get } from "node:https";

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

export function updateAssetFromLink(
  scene: IScene,
  layer: string,
  req: Request,
) {
  let source: URL;
  try {
    source = new URL(req.body.image);
  } catch {
    throw new Error("Invalid URL in body", { cause: 400 });
  }

  // we probalby could do both... but does it matter?!
  if (source.protocol !== "https:")
    throw new Error("Only HTTPS supported", { cause: 400 });

  return new Promise((resolve) => {
    get(source, (response: IncomingMessage) => {
      const { statusCode, headers } = response;
      if (statusCode !== 200)
        throw new Error(
          `Unable to download ${layer} from ${source}: status was ${statusCode}`,
          { cause: 500 },
        );

      if (!("content-type" in headers))
        throw new Error(
          `Unable to infer content type for ${source} from headers: ${headers}`,
          { cause: 500 },
        );

      const ext = getContentTypeExtension(headers["content-type"]);
      if (!ext)
        throw new Error(`Invalid mime type: ${headers["content-type"]}`, {
          cause: 406,
        });

      const fileName = `${layer}.${ext}`;
      const dest = `${DEST_FOLDER}/${fileName}`;
      const update: LayerUpdate = {
        id: scene._id.toString(),
        layer: layer,
        path: fileName,
      };
      response.pipe(
        createWriteStream(dest)
          .on("finish", () => {
            // updateTableState(layer, fileName);
            resolve(update);
          })
          .on("error", () => {
            throw new Error(`Error while writing to destination ${dest}`, {
              cause: 500,
            });
          }),
      );
    }).on("error", () => {
      throw new Error(`Unable to fetch from URL ${source}`, { cause: 500 });
    });
  });
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
