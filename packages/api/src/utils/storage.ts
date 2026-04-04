import { NextFunction, Request, Response } from "express";

import { DEST_FOLDER } from "./constants";
import { LocalStorageDriver } from "./localstore";
import { log } from "./logger";
import { S3StorageDriver } from "./s3store";

const STORAGE_PROVIDER_LOCAL = "local";
const STORAGE_PROVIDER_S3 = "s3";
const PUBLIC_PREFIX = `${DEST_FOLDER}/`;

export interface StorageDriver {
  init(): Promise<void>;
  putFromTemp(
    tempPath: string,
    key: string,
    contentType?: string,
  ): Promise<string>;
  deleteByLocation(location: string): Promise<void>;
  sendPublicObject(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
}

function getStorageProvider() {
  return (
    process.env.STORAGE_PROVIDER?.trim().toLowerCase() || STORAGE_PROVIDER_LOCAL
  );
}

export function ensurePublicLocation(path: string): string {
  const clean = (path || "").replace(/^\/+/, "");
  if (clean.startsWith(PUBLIC_PREFIX)) return clean;
  return `${PUBLIC_PREFIX}${clean}`;
}

export function locationToKey(location: string): string {
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

export function reqPathToKey(req: Request): string {
  const key = decodeURIComponent(req.path || "").replace(/^\/+/, "");
  if (!key || key.includes("..")) {
    throw new Error("Invalid asset path", { cause: 400 });
  }
  return key;
}

export function inferContentTypeFromKey(key: string): string | undefined {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return undefined;
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

export function getS3MigrationContext() {
  if (!(driver instanceof S3StorageDriver)) return null;
  return driver.getMigrationContext();
}

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
