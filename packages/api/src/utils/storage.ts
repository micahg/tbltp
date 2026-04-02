import { NextFunction, Request, Response } from "express";
import { createReadStream } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { Readable } from "node:stream";

import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { DEST_FOLDER } from "./constants";
import { log } from "./logger";

const STORAGE_PROVIDER_LOCAL = "local";
const STORAGE_PROVIDER_S3 = "s3";
const PUBLIC_PREFIX = `${DEST_FOLDER}/`;

interface StorageDriver {
  init(): Promise<void>;
  putFromTemp(
    tempPath: string,
    key: string,
    contentType?: string,
  ): Promise<string>;
  deleteByLocation(location: string): Promise<void>;
  sendPublicObject(req: Request, res: Response, next: NextFunction): Promise<void>;
}

function getStorageProvider() {
  return (
    process.env.STORAGE_PROVIDER?.trim().toLowerCase() ||
    STORAGE_PROVIDER_LOCAL
  );
}

function ensurePublicLocation(path: string): string {
  const clean = (path || "").replace(/^\/+/, "");
  if (clean.startsWith(PUBLIC_PREFIX)) return clean;
  return `${PUBLIC_PREFIX}${clean}`;
}

function locationToKey(location: string): string {
  const normalized = ensurePublicLocation(location);
  if (!normalized.startsWith(PUBLIC_PREFIX)) {
    throw new Error(`Invalid public path: ${location}`, { cause: 400 });
  }

  const key = normalized.slice(PUBLIC_PREFIX.length).replace(/^\/+/, "");
  if (!key || key.includes("..")) {
    throw new Error(`Invalid public key: ${location}`, { cause: 400 });
  }
  return key;
}

function reqPathToKey(req: Request): string {
  const key = decodeURIComponent(req.path || "").replace(/^\/+/, "");
  if (!key || key.includes("..")) {
    throw new Error("Invalid asset path", { cause: 400 });
  }
  return key;
}

function inferContentTypeFromKey(key: string): string | undefined {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return undefined;
}

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

class LocalStorageDriver implements StorageDriver {
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

class S3StorageDriver implements StorageDriver {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    const bucket = process.env.STORAGE_S3_BUCKET?.trim();
    const region = process.env.STORAGE_S3_REGION?.trim() || "us-east-1";
    const endpoint = process.env.STORAGE_S3_ENDPOINT?.trim();
    const accessKeyId = process.env.STORAGE_S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.STORAGE_S3_SECRET_ACCESS_KEY?.trim();
    const forcePathStyle =
      process.env.STORAGE_S3_FORCE_PATH_STYLE?.toLowerCase() === "true";

    if (!bucket) {
      throw new Error("STORAGE_S3_BUCKET is required for s3 storage provider");
    }
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "STORAGE_S3_ACCESS_KEY_ID and STORAGE_S3_SECRET_ACCESS_KEY are required for s3 storage provider",
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async init() {
    return;
  }

  async putFromTemp(tempPath: string, key: string, contentType?: string) {
    const cleanKey = locationToKey(key);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
          Body: createReadStream(tempPath),
          ContentType: contentType,
        }),
      );
    } catch (err) {
      const msg = `Error uploading ${cleanKey} to S3 bucket ${this.bucket}`;
      log.error(msg, err);
      throw new Error(msg, { cause: 500 });
    } finally {
      try {
        await rm(tempPath, { force: true });
      } catch (err) {
        log.error(`Unable to delete temp file ${tempPath}`, err);
      }
    }

    return ensurePublicLocation(cleanKey);
  }

  async deleteByLocation(location: string) {
    const cleanKey = locationToKey(location);
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        }),
      );
    } catch (err) {
      const msg = `Error deleting ${cleanKey} from S3 bucket ${this.bucket}`;
      log.error(msg, err);
      throw new Error(msg, { cause: 500 });
    }
  }

  async sendPublicObject(req: Request, res: Response, next: NextFunction) {
    try {
      const key = reqPathToKey(req);
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      res.setHeader(
        "Content-Type",
        result.ContentType || inferContentTypeFromKey(key) || "application/octet-stream",
      );

      const body = result.Body as Readable | undefined;
      if (!body) {
        res.sendStatus(404);
        return;
      }

      body.on("error", (err) => {
        next(err);
      });
      body.pipe(res);
    } catch (err) {
      if (
        err instanceof NoSuchKey ||
        (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404)
      ) {
        res.sendStatus(404);
        return;
      }
      next(err);
    }
  }
}

function newStorageDriver(): StorageDriver {
  const provider = getStorageProvider();
  if (provider === STORAGE_PROVIDER_S3) return new S3StorageDriver();
  if (provider === STORAGE_PROVIDER_LOCAL) return new LocalStorageDriver();

  throw new Error(
    `Invalid STORAGE_PROVIDER '${provider}'. Supported values: ${STORAGE_PROVIDER_LOCAL}, ${STORAGE_PROVIDER_S3}`,
  );
}

const driver: StorageDriver = newStorageDriver();

export async function initializeStorage() {
  await driver.init();
  log.info(`Storage provider initialized: ${getStorageProvider()}`);
}

export function buildPublicAssetLocation(key: string) {
  return ensurePublicLocation(key);
}

export async function putPublicAssetFromUpload(
  tempPath: string,
  key: string,
  contentType?: string,
) {
  return driver.putFromTemp(tempPath, key, contentType);
}

export async function deletePublicAsset(location: string) {
  return driver.deleteByLocation(location);
}

export async function publicAssetHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return driver.sendPublicObject(req, res, next);
}