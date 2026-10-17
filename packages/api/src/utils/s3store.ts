import {
  CopyObjectCommand,
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
const UPLOAD_URL_EXPIRY_SECONDS = 60;

/**
 * Lifetime (seconds) of presigned download URLs handed to clients. Also
 * doubles as the browser-side "refresh me" hint: clients may not cache
 * anything they fetch through a presigned url beyond the session it was
 * issued in, and refetch a fresh url when one expires mid-session.
 */
const DOWNLOAD_URL_EXPIRY_SECONDS =
  Number.parseInt(process.env.DOWNLOAD_URL_EXPIRY_SECONDS || "", 10) || 21600;

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

/**
 * Create a short-lived presigned URL the client can use to GET a stored
 * object directly from the bucket. A fresh signature is minted for every
 * call -- there is no memoization, so replays and stale tabs can at most
 * fetch bytes they were already allowed to fetch, for the lifetime of the
 * url.
 *
 * The url is signed for the exact bucket and key only. Clients must not
 * append query parameters (that breaks the signature) and must not send an
 * Authorization header alongside it.
 *
 * @param location A public location (`public/...`) or the key relative to
 * the public prefix (`<user>/assets/<assetId>.<ext>`).
 */
export async function createDownloadUrl(location: string) {
  const key = locationToKey(location);
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS },
    );
  } catch (err) {
    const msg = `Error presigning download of ${key} from S3 bucket ${bucket}`;
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

export async function deleteObject(key: string) {
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

/**
 * Copy an object server-side and replace its metadata. The source key
 * segments are URL-encoded per S3 copy-source requirements (the keys this
 * app builds are hex/uuid based so this is a no-op, but it keeps the
 * copy-source well formed regardless).
 *
 * MetadataDirective is REPLACE so the destination's Content-Type and
 * Cache-Control are exactly what the caller specifies -- downloads serve
 * those headers directly from the stored object (response overrides on
 * presigned urls are unreliable on some providers, e.g. Cloudflare R2).
 *
 * @param sourceKey The key being copied from.
 * @param destinationKey The key being copied to.
 * @param contentType The content type stored (and served) for the object.
 * @param cacheControl The cache control stored (and served) for the object.
 */
export async function copyObject(
  sourceKey: string,
  destinationKey: string,
  contentType: string,
  cacheControl: string,
) {
  const copySource = `${bucket}/${sourceKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: copySource,
        Key: destinationKey,
        ContentType: contentType,
        CacheControl: cacheControl,
        MetadataDirective: "REPLACE",
      }),
    );
  } catch (err) {
    const msg = `Error copying ${sourceKey} to ${destinationKey} in S3 bucket ${bucket}`;
    log.error(msg, err);
    throw new Error(msg, { cause: 500 });
  }
}

export async function deletePublicAsset(location: string) {
  return deleteObject(locationToKey(location));
}
