import { cp, rm } from 'node:fs';

import { IncomingMessage } from 'node:http';
import { get } from "node:https";
import { createWriteStream } from 'node:fs';

import { Request, Response } from "express";

import { log } from "../utils/logger";
import { CONTENT_TYPE_EXTS, DEST_FOLDER, ERR_HTTPS_ONLY, ERR_INVALID_URL, VALID_CONTENT_TYPES, VALID_LAYERS } from '../utils/constants';
import { updateTableState } from '../utils/tablestate';

export interface LayerUpdate {
  layer: string,
  path: string,
}

/*export function getAsset(req: Request, res: Response, next: any) {
  stat(DEST, (err, stats) => {
    if (err) {
      log.error(`Unable to stat ${DEST}: ${JSON.stringify(err)}`);
      return res.sendStatus(404);
    }

    let fullPath = path.join(__dirname, DEST);
    log.info(`MICAH sending ${fullPath}`);
    res.sendFile(fullPath, err => {
      if (err) {
        log.error(`Unable to send ${fullPath}: ${JSON.stringify(err)}`);
      }
    });
  });
}*/

/**
 * Figure out the destination exension based on mime type
 * @param contentType the content/mime type
 * @returns null if the mime is invalid, otherwise, the extension to use for the mime
 */
function getContentTypeExtension(contentType: string) {
  if (!VALID_CONTENT_TYPES.includes(contentType)) return null;
  return CONTENT_TYPE_EXTS[VALID_CONTENT_TYPES.indexOf(contentType)];
}

function updateAssetFromLink(layer: string, req: Request, res: Response) {
  let source: URL;
  
  try {
    source = new URL(req.body.image);
  } catch (err) {
    log.error(`Invalid URL in body`);
    return res.status(400).send(ERR_INVALID_URL);
  }

  // we probalby could do both... but does it matter?!
  if (source.protocol !== 'https:') {
    log.error(`Uh... we don't support http - use HTTPs`);
    return res.status(400).send(ERR_HTTPS_ONLY);
  }

  get(source, (response: IncomingMessage) => {
    const { statusCode, headers} = response;
    if (statusCode !==200) {
      log.error(`Unable to download ${layer} from ${source}: status was ${statusCode}`);
      return res.sendStatus(500);
    }

    if (!('content-type' in headers)) {
      log.error(`Unable to infer content type for ${source} from headers: ${headers}`);
      return res.sendStatus(500);
    }

    let ext = getContentTypeExtension(headers['content-type']);
    if (!ext) {
      log.error(`Invalid mime type: ${headers['content-type']}`);
      return res.sendStatus(400);
    }

    let fileName = `${layer}.${ext}`;
    let dest = `${DEST_FOLDER}/${fileName}`
    let update: LayerUpdate = {layer: layer, path: fileName};
    response.pipe(createWriteStream(dest)
      .on('finish', () => {
        updateTableState(layer, fileName);
        return res.json(update);
      })
      .on('error', () => {
        log.error(`Error while writing to destination ${dest}`);
        return res.sendStatus(500);
      })
    );
  }).on('error', () => {
    log.error(`Unable to fetch from URL ${source}`);
    return res.sendStatus(500);
  });
}

function updateAssetFromUpload(layer: string, req: Request, res: Response) {
  let ext = getContentTypeExtension(req.file.mimetype);
  if (!ext) {
    log.error(`Invalid mime type: ${req.file.mimetype}`);
    return res.sendStatus(400);
  }
  let src = req.file.path;
  let fileName = `${layer}.${ext}`
  let dest = `${DEST_FOLDER}/${fileName}`
  cp(src, dest, {force: true, preserveTimestamps: true}, err => {
    if (err) {
      log.error(`Unable to copy ${src} to ${dest}`);
      return res.sendStatus(500);
    }

    log.info(`Updated ${fileName}`);
    let update: LayerUpdate = {layer: layer, path: fileName};
    updateTableState(layer, fileName);

    rm(src, {force: true}, err => {
      if (err) {
        log.error(`Unable to delete ${src}`);
      }
      return res.json(update);
    });
  });
}

export function updateAsset(req: Request, res: Response, next: any) {

  if (!('layer' in req.body)) {
    log.error(`Unspecified layer in asset update request!`);
    return res.sendStatus(400);
  }

  let layer: string = req.body.layer.toLowerCase();
  if (!VALID_LAYERS.includes(layer)) {
    log.error(`Invalid layer name in asset update request: {layer}`);
    return res.sendStatus(400);
  }

  // if there is an image upload, handle it
  if (req.file) return updateAssetFromUpload(layer, req, res);

  // if there is an image, but its not in file format, assume its a link
  if ('image' in req.body) return updateAssetFromLink(layer, req, res);

  // we don't know how to do anything else....
  log.error('No file or link in layer update request.');
  return res.sendStatus(406);

}