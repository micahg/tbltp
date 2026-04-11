const {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} = require("@aws-sdk/client-s3");
const { setTimeout: delay } = require("node:timers/promises");

const bucket = process.env.STORAGE_S3_BUCKET || "tbltp-test-bucket";
const region = process.env.STORAGE_S3_REGION || "us-east-1";
const endpoint = process.env.STORAGE_S3_ENDPOINT || "http://127.0.0.1:4566";
const accessKeyId = process.env.STORAGE_S3_ACCESS_KEY_ID || "test";
const secretAccessKey = process.env.STORAGE_S3_SECRET_ACCESS_KEY || "test";
const forcePathStyle =
  (process.env.STORAGE_S3_FORCE_PATH_STYLE || "true").toLowerCase() ===
  "true";

async function ensureBucket() {
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch (err) {
      const status =
        err instanceof S3ServiceException ? err.$metadata.httpStatusCode : 0;
      const name = err instanceof Error ? err.name : "UnknownError";
      const code =
        err && typeof err === "object" && "Code" in err
          ? String(err.Code)
          : undefined;

      if (status === 404 || code === "NotFound" || name === "NotFound") {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
          return;
        } catch (createErr) {
          const createStatus =
            createErr instanceof S3ServiceException
              ? createErr.$metadata.httpStatusCode
              : 0;
          const createName =
            createErr instanceof Error ? createErr.name : "UnknownError";
          if (
            createStatus === 409 ||
            createName === "BucketAlreadyOwnedByYou" ||
            createName === "BucketAlreadyExists"
          ) {
            return;
          }
          if (attempt === maxAttempts) throw createErr;
        }
      } else if (attempt === maxAttempts) {
        throw err;
      }
    }

    await delay(1000);
  }
}

module.exports = async function globalSetup() {
  if ((process.env.STORAGE_PROVIDER || "").toLowerCase() !== "s3") return;
  await ensureBucket();
};