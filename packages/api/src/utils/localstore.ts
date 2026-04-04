import { NextFunction, Request, Response } from "express";
import { cp, mkdir, rm } from "node:fs/promises";

import { DEST_FOLDER } from "./constants";
import { log } from "./logger";
import {
  ensurePublicLocation,
  locationToKey,
  reqPathToKey,
  StorageDriver,
} from "./storage";

async function copyAndDelete(src: string, dest: string) {
  try {
    await cp(src, dest, { force: true, preserveTimestamps: true });
  } catch (err) {
    const msg = `Error copying ${src} to ${dest}`;
    log.error(msg, err);
    throw new Error(msg, { cause: 500 });
  }

  try {
    await rm(src, { force: true });
  } catch (err) {
    log.error(`Unable to delete temp file ${src}`, err);
  }
}

export class LocalStorageDriver implements StorageDriver {
  async init() {
    await mkdir(DEST_FOLDER, { recursive: true });
  }

  async putFromTemp(tempPath: string, key: string) {
    const cleanKey = locationToKey(key);
    const dest = `${DEST_FOLDER}/${cleanKey}`;
    await copyAndDelete(tempPath, dest);
    return ensurePublicLocation(cleanKey);
  }

  async deleteByLocation(location: string) {
    const cleanKey = locationToKey(location);
    await rm(`${DEST_FOLDER}/${cleanKey}`, { force: true });
  }

  async sendPublicObject(req: Request, res: Response, next: NextFunction) {
    try {
      const key = reqPathToKey(req);
      res.sendFile(key, { root: DEST_FOLDER }, (err) => {
        if (!err) return;
        if (err.message.includes("ENOENT")) {
          res.sendStatus(404);
          return;
        }
        next(err);
      });
    } catch (err) {
      next(err);
    }
  }
}
