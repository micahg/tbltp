import { cp, fstat, rm, stat } from 'node:fs';

import { Request, Response } from "express";

import { log } from "../utils/logger";
import path = require('node:path');
import { ASSET_UPDATED_SIG, DEST_FOLDER, VALID_LAYERS, VALID_MIME } from '../utils/constants';
import { LayerUpdate } from '../utils/websocket';

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


export function updateAsset(req: Request, res: Response, next: any) {
  if (!req.file) {
    log.error('No file in layer update request.');
    return res.sendStatus(406);
  }

  if (!('layer' in req.body)) {
    log.error(`Unspecified layer in asset update request!`);
    return res.sendStatus(400);
  }

  let layer: string = req.body.layer.toLowerCase();
  if (!VALID_LAYERS.includes(layer)) {
    log.error(`Invalid layer name in asset update request: {layer}`);
    return res.sendStatus(400);
  }

  let mime: string = req.file.mimetype;
  if (!VALID_MIME.includes(mime)) {
    log.error(`Invalid mime type: ${mime}`);
    return res.sendStatus(400);
  }

  let ext: string = mime.split('/')[1];
  let src = req.file.path;
  let dest = `${DEST_FOLDER}/${layer}.${ext}`
  cp(src, dest, {force: true, preserveTimestamps: true}, err => {
    if (err) {
      log.error(`Unable to copy ${src} to ${dest}`);
      return res.sendStatus(500);
    }

    // redo dest for public consumption (eg: just layer.ext prefix)
    log.info(`Updated ${layer} ${dest}`);
    let update: LayerUpdate = {layer: layer, path: `${layer}.${ext}`};
    res.app.emit(ASSET_UPDATED_SIG, update);

    rm(src, {force: true}, err => {
      if (err) {
        log.error(`Unable to delete ${src}`);
      }
      return res.json(update)
    })
  });
}