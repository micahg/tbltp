import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";

import {
  CopyObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import { AssetModel } from "../models/asset";
import { log } from "./logger";
import {
  ensurePublicLocation,
  getS3MigrationContext,
  inferContentTypeFromKey,
  locationToKey,
} from "./storage";

interface MigrationAsset {
  _id: unknown;
  user: unknown;
  location?: string;
}

function buildNormalizedKey(asset: MigrationAsset, currentKey: string) {
  const assetId = String(asset._id);
  const userId = String(asset.user);
  const extMatch = currentKey.toLowerCase().match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : "";
  return `${userId}/assets/${assetId}${ext}`;
}

function buildCopySource(bucket: string, key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${bucket}/${encodedKey}`;
}

async function objectExists(client: S3Client, bucket: string, key: string) {
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
      err instanceof S3ServiceException &&
      err.$metadata.httpStatusCode === 404
    ) {
      return false;
    }
    throw err;
  }
}

async function migrateAssetsToS3() {
  const migrationContext = getS3MigrationContext();
  if (!migrationContext) {
    return;
  }

  const { bucket, client } = migrationContext;

  let scanned = 0;
  let uploaded = 0;
  let copiedInS3 = 0;
  let alreadyInS3 = 0;
  let normalized = 0;
  let missingOnDisk = 0;
  let errors = 0;

  log.info("Starting local-to-S3 asset migration thread");

  const cursor = AssetModel.find({
    location: { $exists: true, $nin: [null, ""] },
  })
    .select("_id user location")
    .lean<MigrationAsset>()
    .cursor();

  for await (const asset of cursor) {
    scanned += 1;

    const location = ensurePublicLocation(String(asset.location || ""));

    let currentKey: string;
    try {
      currentKey = locationToKey(location);
    } catch (err) {
      errors += 1;
      log.error(
        `Skipping asset ${String(asset._id)} due to invalid location ${location}`,
        err,
      );
      continue;
    }

    const targetKey = buildNormalizedKey(asset, currentKey);
    const targetLocation = ensurePublicLocation(targetKey);
    const shouldNormalizeLocation = targetLocation !== location;

    let hasLocalFile = false;

    try {
      await access(location);
      hasLocalFile = true;
    } catch {
      hasLocalFile = false;
    }

    try {
      const targetExists = await objectExists(client, bucket, targetKey);
      if (targetExists) {
        alreadyInS3 += 1;
      } else if (hasLocalFile) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: targetKey,
            Body: createReadStream(location),
            ContentType: inferContentTypeFromKey(targetKey),
          }),
        );
        uploaded += 1;
      } else {
        const sourceExists = await objectExists(client, bucket, currentKey);
        if (!sourceExists) {
          missingOnDisk += 1;
          continue;
        }

        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: targetKey,
            CopySource: buildCopySource(bucket, currentKey),
            ContentType: inferContentTypeFromKey(targetKey),
          }),
        );
        copiedInS3 += 1;
      }

      if (shouldNormalizeLocation) {
        await AssetModel.updateOne(
          { _id: asset._id },
          { $set: { location: targetLocation } },
        );
        normalized += 1;
      }
    } catch (err) {
      errors += 1;
      log.error(
        `Failed migrating asset ${String(asset._id)} (${location})`,
        err,
      );
    }

    if (scanned % 100 === 0) {
      log.info(
        `Asset migration progress scanned=${scanned} uploaded=${uploaded} copied=${copiedInS3} existing=${alreadyInS3} normalized=${normalized} missingLocal=${missingOnDisk} errors=${errors}`,
      );
    }
  }

  log.info(
    `Asset migration complete scanned=${scanned} uploaded=${uploaded} copied=${copiedInS3} existing=${alreadyInS3} normalized=${normalized} missingLocal=${missingOnDisk} errors=${errors}`,
  );
}

export function startAssetMigrationThread() {
  void migrateAssetsToS3().catch((err) => {
    log.error("Asset migration thread failed", err);
  });
}
