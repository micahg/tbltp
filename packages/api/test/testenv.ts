import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { MongoClient, Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Server } from "node:http";

const S3_ENDPOINT = "http://127.0.0.1:4566";
const S3_REGION = "us-east-1";
const S3_CREDENTIALS = { accessKeyId: "test", secretAccessKey: "test" };

export interface TestEnv {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any;
  shutDown: (signal: string) => void;
  db: Db;
  s3: S3Client;
  bucket: string;
  server?: Server;
}

export async function setupTestEnv(opts?: {
  returnServer?: boolean;
}): Promise<TestEnv> {
  const bucket = `tbltp-test-${Date.now()}`;

  process.env["STORAGE_PROVIDER"] = "s3";
  process.env["STORAGE_S3_BUCKET"] = bucket;
  process.env["STORAGE_S3_REGION"] = S3_REGION;
  process.env["STORAGE_S3_ACCESS_KEY_ID"] = S3_CREDENTIALS.accessKeyId;
  process.env["STORAGE_S3_SECRET_ACCESS_KEY"] = S3_CREDENTIALS.secretAccessKey;
  process.env["STORAGE_S3_ENDPOINT"] = S3_ENDPOINT;
  process.env["STORAGE_S3_FORCE_PATH_STYLE"] = "true";

  const s3 = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
    credentials: S3_CREDENTIALS,
  });
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));

  const mongodb = await MongoMemoryServer.create({
    instance: { storageEngine: "wiredTiger" },
  });
  process.env["MONGO_URL"] = `${mongodb.getUri()}ntt`;
  const mongocl = new MongoClient(process.env["MONGO_URL"]);
  const db = mongocl.db("ntt");

  // Dynamic import AFTER env vars are set so S3StorageDriver reads the correct config
  const serverModule = await import("../src/server");
  serverModule.startUp();
  const serverOrPromise = serverModule.serverPromise;
  const server = await serverOrPromise;

  return {
    app: serverModule.app,
    shutDown: serverModule.shutDown,
    db,
    s3,
    bucket,
    server: opts?.returnServer ? server : undefined,
    // Stash for teardown — attach to the returned object via closure
    _mongodb: mongodb,
    _mongocl: mongocl,
  } as TestEnv & { _mongodb: MongoMemoryServer; _mongocl: MongoClient };
}

export async function teardownTestEnv(env: TestEnv): Promise<void> {
  const { s3, bucket, shutDown } = env;
  const internal = env as TestEnv & {
    _mongodb: MongoMemoryServer;
    _mongocl: MongoClient;
  };

  shutDown("SIGJEST");
  await internal._mongocl.close();
  await internal._mongodb.stop();

  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  if (listed.Contents?.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: listed.Contents.map(({ Key }) => ({ Key })) },
      }),
    );
  }
  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
}
