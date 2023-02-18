import { cp, fstat, rm, stat } from 'node:fs';

import { Request, Response } from "express";

import { log } from "../utils/logger";
import path = require('node:path');
import { ASSET_UPDATED_SIG } from '../utils/constants';

const DEST = 'public/overlay.png';


export function getAsset(req: Request, res: Response, next: any) {
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
}


export function updateAsset(req: Request, res: Response, next: any) {
  if (!req.file) {
    res.sendStatus(406);
    return;
  }

  if (req.file.mimetype != 'image/png') {
    log.error(`Invalid mime type: ${req.file.mimetype}`);
    res.sendStatus(400);
  }

  let src = req.file.path;
  cp(src, DEST, {force: true, preserveTimestamps: true}, err => {
    if (err) {
      log.error(`Unable to copy ${src} to ${DEST}`);
      return res.sendStatus(500);
    }

    log.info(`Updated ${DEST}`);

    // even if we can't remove it, asset is updated at this point
    // next();
    res.app.emit(ASSET_UPDATED_SIG, DEST);

    rm(src, {force: true}, err => {
      if (err) {
        log.error(`Unable to delete ${src}`);
      }
      return res.sendStatus(204);
    })
  });
}