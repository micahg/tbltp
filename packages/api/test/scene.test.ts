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
import { userZero, userOne } from "./assets/auth";
import { fail } from "node:assert";
import { ScenelessTokenInstance } from "@micahg/tbltp-common";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let shutDown: (signal: string) => void;
let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let s3: S3Client;
let bucket: string;
let scenesCollection: Collection;
let usersCollection: Collection;
let assetsCollection: Collection;
let tokensCollection: Collection;
let tokenInstancesCollection: Collection;

let u0DefScene;
let u1DefScene;

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
  assetsCollection = db.collection("assets");
  tokensCollection = db.collection("tokens");
  tokenInstancesCollection = db.collection("tokeninstances");

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

  describe("create", () => {
    it("Should create default scenes", async () => {
      const resp0 = await request(app).get("/scene");
      u0DefScene = resp0.body[0];
      const uid1 = u0DefScene.user;
      expect(resp0.statusCode).toBe(200);
      expect(u0DefScene.description).toEqual("default");
      const sceneCount0 = await scenesCollection.countDocuments();
      expect(sceneCount0).toBe(1);
      const userCount0 = await usersCollection.countDocuments();
      expect(userCount0).toBe(1);

      (getFakeUser as jest.Mock).mockReturnValue(userOne);

      const resp = await request(app).get("/scene");
      u1DefScene = resp.body[0];
      const uid2 = u1DefScene.user;
      expect(resp.statusCode).toBe(200);
      expect(u1DefScene.description).toEqual("default");
      const sceneCount = await scenesCollection.countDocuments();
      expect(sceneCount).toBe(2);
      const userCount = await usersCollection.countDocuments();
      expect(userCount).toBe(2);
      expect(uid1).not.toEqual(uid2);
    });

    it("Should 401 a totally bogus user", async () => {
      (getFakeUser as jest.Mock).mockReturnValue("THIS_ONE_DOES_NOT_EXST");
      const resp = await request(app).get("/scene/000000000000000000000000");
      expect(resp.statusCode).toBe(401);
    });

    it("Should 400 an invalid scene id", async () => {
      const resp = await request(app).get("/scene/asdf");
      expect(resp.statusCode).toEqual(400);
    });

    it("Should 404 a scene it does not have", async () => {
      const resp = await request(app).get("/scene/000000000000000000000000");
      expect(resp.statusCode).toEqual(404);
    });

    it("Should find a scene it does have access to", async () => {
      const url = `/scene/${u0DefScene._id}`;
      const resp = await request(app).get(url);
      expect(resp.statusCode).toBe(200);
      expect(resp.body._id).toEqual(u0DefScene._id);
      expect(resp.body.description).toEqual("default");
    });

    it("Should accept a background", async () => {
      let resp;
      try {
        resp = await assignSceneLayer(u0DefScene._id, "player");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.playerId).toMatch(/[a-f0-9]{24}/);
      const asset = await assetsCollection.findOne({
        name: `scene ${u0DefScene._id} player`,
      });
      expect(asset).toBeTruthy();
      expect(asset.name).toBe(`scene ${u0DefScene._id} player`);
      expect(asset.tags).toEqual(["scene"]);
    });

    it("Should accept a overlay", async () => {
      let resp;
      try {
        resp = await assignSceneLayer(u0DefScene._id, "overlay");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.overlayId).toMatch(/[a-f0-9]{24}/);
    });

    it("Should accept a gamemaster", async () => {
      let resp;
      try {
        resp = await assignSceneLayer(u0DefScene._id, "detail");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.detailId).toMatch(/[a-f0-9]{24}/);
    });

    it("Should update the viewport", async () => {
      const scene = await request(app).get("/scene");
      const url = `/scene/${scene.body[0]._id}/viewport`;
      const resp = await request(app)
        .put(url)
        .send({ viewport: { x: 0, y: 0, width: 0, height: 0 } });
      expect(resp.statusCode).toBe(200);
      expect(resp.body.viewport.width).toBe(0);
    });

    it("Should update the background", async () => {
      const resp = await request(app)
        .put(`/scene/${u0DefScene._id}/viewport`)
        .send({ backgroundSize: { x: 0, y: 0, width: 0, height: 0 } });
      expect(resp.statusCode).toBe(200);
      expect(resp.body.backgroundSize.width).toBe(0);
    });

    it("Should update the viewport and background", async () => {
      const resp = await request(app)
        .put(`/scene/${u0DefScene._id}/viewport`)
        .send({
          backgroundSize: { x: 0, y: 0, width: 1, height: 1 },
          viewport: { x: 0, y: 0, width: 1, height: 1 },
        });
      expect(resp.statusCode).toBe(200);
      expect(resp.body.viewport.width).toBe(1);
      expect(resp.body.backgroundSize.width).toBe(1);
    });

    it("Should update the angle", async () => {
      const scene = await request(app).get("/scene");
      const url = `/scene/${scene.body[0]._id}/viewport`;
      const resp = await request(app).put(url).send({ angle: 90 });
      expect(resp.statusCode).toBe(200);
      expect(resp.body.angle).toBe(90);
    });

    it("Should handle an empty payload", async () => {
      const resp = await request(app)
        .put(`/scene/${u0DefScene._id}/viewport`)
        .send({});
      expect(resp.statusCode).toBe(400);
    });

    it("Should handle bad viewport", async () => {
      const resp = await request(app)
        .put(`/scene/${u0DefScene._id}/viewport`)
        .send({
          viewport: "notAVP",
        });
      expect(resp.statusCode).toBe(400);
    });

    it("Should handle bad background", async () => {
      const resp = await request(app)
        .put(`/scene/${u0DefScene._id}/viewport`)
        .send({
          backgroundSize: "notABG",
        });
      expect(resp.statusCode).toBe(400);
    });

    it("Should handle bad angle", async () => {
      const resp = await request(app)
        .put(`/scene/${u0DefScene._id}/viewport`)
        .send({
          angle: "noAngle",
        });
      expect(resp.statusCode).toBe(400);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
      await tokensCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
      await assetsCollection.deleteMany({}); // Clean up the database
      await tokenInstancesCollection.deleteMany({}); // Clean up the database
      await scenesCollection.deleteMany({}); // Clean up the database
    });
    afterEach(async () => {
      await tokensCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
      await assetsCollection.deleteMany({}); // Clean up the database
      await tokenInstancesCollection.deleteMany({}); // Clean up the database
      await scenesCollection.deleteMany({}); // Clean up the database
    });
    it("Should delete a scene", async () => {
      // create scene
      const defaultScene = await request(app).get("/scene");
      expect(defaultScene.statusCode).toBe(200);

      const sceneTwo = await request(app).put("/scene").send({
        description: "scene two",
      });
      expect(sceneTwo.statusCode).toBe(200);
      let scenes = await scenesCollection.find({}).toArray();
      expect(scenes.length).toBe(2);

      // create tokens
      const first = await request(app).put("/token").send({ name: "first" });
      const second = await request(app).put("/token").send({ name: "second" });
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      let tokens = await tokensCollection.find({}).toArray();
      expect(tokens.length).toBe(2);

      const firstInstance: Omit<ScenelessTokenInstance, "angle"> = {
        name: "first instance",
        token: first.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      };

      const secondInstance: Omit<ScenelessTokenInstance, "angle"> = {
        name: "second instance",
        token: second.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      };

      // create scene tokens
      expect(
        (
          await request(app)
            .put(`/scene/${defaultScene.body[0]._id}/token`)
            .send(firstInstance)
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await request(app)
            .put(`/scene/${defaultScene.body[0]._id}/token`)
            .send(secondInstance)
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await request(app)
            .put(`/scene/${sceneTwo.body._id}/token`)
            .send(firstInstance)
        ).statusCode,
      ).toBe(201);
      expect(
        (
          await request(app)
            .put(`/scene/${sceneTwo.body._id}/token`)
            .send(secondInstance)
        ).statusCode,
      ).toBe(201);

      let instances = await tokenInstancesCollection.find({}).toArray();
      expect(instances.length).toBe(4);

      expect(
        (await request(app).delete(`/scene/${sceneTwo.body._id}`)).statusCode,
      ).toBe(204);
      scenes = await scenesCollection.find({}).toArray();
      expect(scenes.length).toBe(1);

      const assets = await assetsCollection.find({}).toArray();
      expect(assets.length).toBe(0);

      tokens = await tokensCollection.find({}).toArray();
      expect(tokens.length).toBe(2);

      instances = await tokenInstancesCollection.find({}).toArray();
      expect(instances.length).toBe(2);
    });
  });
});
