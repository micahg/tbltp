process.env["DISABLE_AUTH"] = "true";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import * as request from "supertest";
import {
  afterAll,
  beforeEach,
  beforeAll,
  describe,
  it,
  expect,
  jest,
} from "@jest/globals";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";

import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Collection } from "mongodb";
import { userZero } from "./assets/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let shutDown: (signal: string) => void;
let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let s3: S3Client;
let bucket: string;
let scenesCollection: Collection;
let usersCollection: Collection;

let u0DefScene;

async function assignSceneLayer(
  sceneId: string,
  layer: "player" | "detail" | "overlay",
) {
  const scene = await request(app).get(`/scene/${sceneId}`);
  let assetId = scene.body[`${layer}Id`] as string | undefined;

  if (!assetId) {
    const created = await request(app)
      .put("/asset")
      .send({ name: `scene ${sceneId} ${layer}`, tags: ["scene"] });
    assetId = created.body._id;
  }

  await request(app)
    .put(`/asset/${assetId}/data`)
    .attach("asset", "test/assets/1x1.png");

  return request(app)
    .put(`/scene/${sceneId}/${layer}`)
    .send({ assetId });
}

jest.mock("../src/utils/auth");

jest.setTimeout(30000);

beforeAll(async () => {
  bucket = `tbltp-test-${Date.now()}`;

  process.env["STORAGE_PROVIDER"] = "s3";
  process.env["STORAGE_S3_BUCKET"] = bucket;
  process.env["STORAGE_S3_REGION"] = "us-east-1";
  process.env["STORAGE_S3_ACCESS_KEY_ID"] = "test";
  process.env["STORAGE_S3_SECRET_ACCESS_KEY"] = "test";
  process.env["STORAGE_S3_ENDPOINT"] = "http://127.0.0.1:4566";
  process.env["STORAGE_S3_FORCE_PATH_STYLE"] = "true";

  s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://127.0.0.1:4566",
    forcePathStyle: true,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));

  // mongo 7 needs wild tiger
  mongodb = await MongoMemoryServer.create({
    instance: { storageEngine: "wiredTiger" },
  });
  process.env["MONGO_URL"] = `${mongodb.getUri()}ntt`;
  mongocl = new MongoClient(process.env["MONGO_URL"]);
  const db = mongocl.db("ntt");
  usersCollection = db.collection("users");
  scenesCollection = db.collection("scenes");

  (getOAuthPublicKey as jest.Mock).mockReturnValue(Promise.resolve("pubkey"));

  // Dynamic import AFTER env vars are set so S3StorageDriver reads the correct config
  const serverModule = await import("../src/server");
  app = serverModule.app;
  shutDown = serverModule.shutDown;

  serverModule.startUp();
  await serverModule.serverPromise;
});

afterAll(async () => {
  shutDown("SIGJEST");
  await mongocl.close();
  await mongodb.stop();
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
});

describe("scene", () => {
  // start each test with the zero user as the calling user
  beforeEach(() => {
    (getFakeUser as jest.Mock).mockReturnValue(userZero);
  });

  // setup the base scene
  it("should create a base scene first", async () => {
    const resp0 = await request(app).get("/scene");
    u0DefScene = resp0.body[0];
    const uid1 = u0DefScene.user;
    expect(resp0.statusCode).toBe(200);
    expect(u0DefScene.description).toEqual("default");
    const sceneCount0 = await scenesCollection.countDocuments();
    expect(sceneCount0).toBe(1);
    const userCount0 = await usersCollection.countDocuments();
    expect(userCount0).toBe(1);
    await assignSceneLayer(u0DefScene._id, "player");
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      .send({
        backgroundSize: { x: 0, y: 0, width: 1, height: 1 },
        viewport: { x: 0, y: 0, width: 1, height: 1 },
      });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.viewport.width).toBe(1);
    expect(resp.body.playerId).toMatch(/[a-f0-9]{24}/);
    expect(resp.body.backgroundSize.width).toBe(1);
  });

  it("Should get an empty state until we update", async () => {
    const resp = await request(app).get("/state");
    expect(resp.statusCode).toBe(200);
    const table = resp.body;
    expect(table).toBeNull();
  });

  it("Should fail without a scene id", async () => {
    const resp = await request(app).put("/state").send({});
    expect(resp.statusCode).toBe(400);
  });

  it("Should fail with a bad scene id", async () => {
    const resp = await request(app).put("/state").send({ scene: "badid" });
    expect(resp.statusCode).toBe(400);
  });

  it("Should update with a background", async () => {
    const resp = await request(app)
      .put("/state")
      .send({ scene: u0DefScene._id });
    expect(resp.statusCode).toBe(200);
  });

  it("Should keep playerId set on a second update", async () => {
    const resp = await assignSceneLayer(u0DefScene._id, "player");
    expect(resp.statusCode).toBe(200);
    expect(resp.body.playerId).toMatch(/[a-f0-9]{24}/);
  });

  it("Should set overlayId on a first update", async () => {
    const resp = await assignSceneLayer(u0DefScene._id, "overlay");
    expect(resp.statusCode).toBe(200);
    expect(resp.body.overlayId).toMatch(/[a-f0-9]{24}/);
  });

  it("Should keep overlayId set on a second update", async () => {
    const resp = await assignSceneLayer(u0DefScene._id, "overlay");
    expect(resp.statusCode).toBe(200);
    expect(resp.body.overlayId).toMatch(/[a-f0-9]{24}/);
  });

  it("should fail if the viewport is missing data", async () => {
    const resp0 = await request(app).get("/scene");
    u0DefScene = resp0.body[0];
    const resp = await request(app)
      .put(`/scene/${u0DefScene._id}/viewport`)
      // x is missing
      .send({ backgroundSize: { y: 0, width: 1, height: 1 } });
    expect(resp.statusCode).toBe(400);
  });
});
