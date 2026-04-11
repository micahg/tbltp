import { NextFunction, Request, Response } from "express";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { log } from "./logger";
import {
  ensurePublicLocation,
  inferContentTypeFromKey,
  locationToKey,
  reqPathToKey,
  StorageDriver,
} from "./storage";

export class S3StorageDriver implements StorageDriver {
  private readonly bucket: string;
  private readonly client: S3Client;

  private static normalizeEndpoint(rawEndpoint?: string) {
    const endpoint = rawEndpoint?.trim();
    if (!endpoint) return undefined;
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }
    return `https://${endpoint}`;
  }

  getMigrationContext() {
    return {
      bucket: this.bucket,
      client: this.client,
    };
  }

  constructor() {
    const bucket = process.env.STORAGE_S3_BUCKET?.trim();
    const region = process.env.STORAGE_S3_REGION?.trim() || "us-east-1";
    const endpoint = S3StorageDriver.normalizeEndpoint(
      process.env.STORAGE_S3_ENDPOINT,
    );
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
      // Disable automatic checksum computation for streaming uploads — the
      // SDK reads the stream to compute CRC32 by default, consuming it before
      // the body is sent.
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async init() {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        }),
      );
      log.info(`S3 bucket connectivity OK: ${this.bucket}`);
    } catch (err) {
      const msg = `Unable to access S3 bucket '${this.bucket}' during startup`;
      log.error(msg, err);
      throw new Error(msg, { cause: 500 });
    }
  }

  async putFromTemp(tempPath: string, key: string, contentType?: string) {
    const cleanKey = locationToKey(key);
    try {
      const { size } = await stat(tempPath);
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
          Body: createReadStream(tempPath),
          ContentLength: size,
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
        result.ContentType ||
          inferContentTypeFromKey(key) ||
          "application/octet-stream",
      );

      const { Body } = result;
      const body = !Body
        ? null
        : Body instanceof Readable
          ? Body
          : Readable.fromWeb(Body as unknown as ReadableStream);
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
}
