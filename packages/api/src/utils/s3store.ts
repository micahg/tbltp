import { NextFunction, Request, Response } from "express";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { DEST_FOLDER } from "./constants";
import { log } from "./logger";

const PUBLIC_PREFIX = `${DEST_FOLDER}/`;

/** Lifetime (seconds) of presigned upload URLs handed to clients. */
const UPLOAD_URL_EXPIRY_SECONDS = 900;

function normalizeEndpoint(rawEndpoint?: string) {
  const endpoint = rawEndpoint?.trim();
  if (!endpoint) return undefined;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  return `https://${endpoint}`;
}

function newS3Context() {
  const bucket = process.env.STORAGE_S3_BUCKET?.trim();
  const region = process.env.STORAGE_S3_REGION?.trim() || "us-east-1";
  const endpoint = normalizeEndpoint(process.env.STORAGE_S3_ENDPOINT);
  const accessKeyId = process.env.STORAGE_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STORAGE_S3_SECRET_ACCESS_KEY?.trim();
  const forcePathStyle =
    process.env.STORAGE_S3_FORCE_PATH_STYLE?.toLowerCase() === "true";

  if (!bucket) {
    throw new Error("STORAGE_S3_BUCKET is required");
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "STORAGE_S3_ACCESS_KEY_ID and STORAGE_S3_SECRET_ACCESS_KEY are required",
    );
  }

  return {
    bucket,
    client: new S3Client({
      region,
      endpoint,
      forcePathStyle,
      // Disable automatic checksum computation. For presigned URLs this keeps
      // checksum headers out of the signature, so browsers can upload with
      // plain PUT requests.
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

// the client is created at import time so a misconfigured environment fails
// fast at startup (the test environment sets the variables before import)
const { bucket, client } = newS3Context();

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

export async function initializeStorage() {
  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: bucket,
      }),
    );
    log.info(`S3 bucket connectivity OK: ${bucket}`);
  } catch (err) {
    const msg = `Unable to access S3 bucket '${bucket}' during startup`;
    log.error(msg, err);
    throw new Error(msg, { cause: 500 });
  }
}

/**
 * Create a short-lived presigned URL the client can use to PUT an object
 * directly into the bucket. The content type is part of the signature, so
 * the client must send the identical Content-Type header.
 */
export async function createUploadUrl(key: string, contentType: string) {
  try {
    return await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
    );
  } catch (err) {
    const msg = `Error presigning upload of ${key} to S3 bucket ${bucket}`;
    log.error(msg, err);
    throw new Error(msg, { cause: 500 });
  }
}

export async function objectExists(key: string) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    if (
      err instanceof NoSuchKey ||
      (err instanceof S3ServiceException &&
        err.$metadata.httpStatusCode === 404)
    ) {
      return false;
    }
    throw err;
  }
}

export async function deletePublicAsset(location: string) {
  const key = locationToKey(location);
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch (err) {
    const msg = `Error deleting ${key} from S3 bucket ${bucket}`;
    log.error(msg, err);
    throw new Error(msg, { cause: 500 });
  }
}

export async function publicAssetHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const key = reqPathToKey(req);
    const result = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    res.setHeader(
      "Content-Type",
      result.ContentType ||
        inferContentTypeFromKey(key) ||
        "application/octet-stream",
    );

    const { Body } = result;
    const body = !Body
      ? null
      : Body instanceof Readable
        ? Body
        : Readable.fromWeb(
            Body as unknown as import("stream/web").ReadableStream,
          );
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
      (err instanceof S3ServiceException &&
        err.$metadata.httpStatusCode === 404)
    ) {
      res.sendStatus(404);
      return;
    }
    next(err);
  }
}
