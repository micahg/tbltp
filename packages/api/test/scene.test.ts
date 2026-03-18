process.env["DISABLE_AUTH"] = "true";
import { app, serverPromise, shutDown, startUp } from "../src/server";
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
import { Server } from "node:http";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";

import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Collection, ObjectId } from "mongodb";
import { userZero, userOne } from "./assets/auth";
import { fail } from "node:assert";
import { ScenelessTokenInstance } from "@micahg/tbltp-common";
import { migrateLegacySceneContentToAssets } from "../src/utils/scene";

let server: Server;
let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let scenesCollection: Collection;
let usersCollection: Collection;
let assetsCollection: Collection;
let tokensCollection: Collection;
let tokenInstancesCollection: Collection;

let u0DefScene;
let u1DefScene;

jest.mock("../src/utils/auth");

beforeAll((done) => {
  // mongo 7 needs wild tiger
  MongoMemoryServer.create({ instance: { storageEngine: "wiredTiger" } }).then(
    (mongo) => {
      mongodb = mongo;
      process.env["MONGO_URL"] = `${mongo.getUri()}ntt`;
      mongocl = new MongoClient(process.env["MONGO_URL"]);
      const db = mongocl.db("ntt");
      usersCollection = db.collection("users");
      scenesCollection = db.collection("scenes");
      assetsCollection = db.collection("assets");
      tokensCollection = db.collection("tokens");
      tokenInstancesCollection = db.collection("tokeninstances");

      (getOAuthPublicKey as jest.Mock).mockReturnValue(
        Promise.resolve("pubkey"),
      );

      startUp();
      serverPromise
        .then((srvr) => {
          server = srvr;
          done();
        })
        .catch((err) => {
          console.error(`Getting server failed: ${JSON.stringify(err)}`);
          process.exit(1);
        });
    },
  );
});

afterAll(() => {
  shutDown("SIGJEST"); // signal shutdown
  mongocl.close().then(() => mongodb.stop()); // close client then db
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
      const url = `/scene/${u0DefScene._id}/content`;
      let resp;
      try {
        resp = await request(app)
          .put(url)
          .field("layer", "player")
          .attach("image", "test/assets/1x1.png");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.playerId).toMatch(/[a-f0-9]{24}/);
      const asset = await assetsCollection.findOne({
        name: `scene-${u0DefScene._id}-player`,
      });
      expect(asset).toBeTruthy();
      expect(asset.name).toBe(`scene-${u0DefScene._id}-player`);
      expect(asset.tags).toEqual(["scene"]);
    });

    it("Should accept a overlay", async () => {
      const url = `/scene/${u0DefScene._id}/content`;
      let resp;
      try {
        resp = await request(app)
          .put(url)
          .field("layer", "overlay")
          .attach("image", "test/assets/1x1.png");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.overlayId).toMatch(/[a-f0-9]{24}/);
    });

    it("Should accept a gamemaster", async () => {
      const url = `/scene/${u0DefScene._id}/content`;
      let resp;
      try {
        resp = await request(app)
          .put(url)
          .field("layer", "detail")
          .attach("image", "test/assets/1x1.png");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.detailId).toMatch(/[a-f0-9]{24}/);
    });

    it("Should skip scene asset ids when scene assets are disabled", async () => {
      process.env["SCENE_ASSET_DISABLED"] = "true";

      const scene = await request(app)
        .put("/scene")
        .send({ description: "disabled scene" });
      const url = `/scene/${scene.body._id}/content`;

      const resp = await request(app)
        .put(url)
        .field("layer", "player")
        .attach("image", "test/assets/1x1.png");

      expect(resp.statusCode).toBe(200);
      expect(resp.body.playerId).toBeUndefined();

      delete process.env["SCENE_ASSET_DISABLED"];
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

  describe("migration", () => {
    beforeEach(async () => {
      await tokensCollection.deleteMany({});
      await usersCollection.deleteMany({});
      await assetsCollection.deleteMany({});
      await tokenInstancesCollection.deleteMany({});
      await scenesCollection.deleteMany({});
    });

    afterEach(async () => {
      await tokensCollection.deleteMany({});
      await usersCollection.deleteMany({});
      await assetsCollection.deleteMany({});
      await tokenInstancesCollection.deleteMany({});
      await scenesCollection.deleteMany({});
    });

    it("Should ignore legacy layer revision when migrating scene content", async () => {
      const sceneId = new ObjectId();
      const userId = new ObjectId();
      const playerRev = 7;

      await scenesCollection.insertOne({
        _id: sceneId,
        user: userId,
        description: "legacy",
        playerContent: "path/to/player.png",
        playerContentRev: playerRev,
      });

      const migratedCount = await migrateLegacySceneContentToAssets();
      expect(migratedCount).toBe(1);

      const migratedAsset = await assetsCollection.findOne({
        user: userId,
        name: `scene-${sceneId.toString()}-player`,
      });
      expect(migratedAsset).toBeTruthy();
      if (!migratedAsset) {
        fail("Expected migrated player asset to exist");
      }
      expect(migratedAsset.revision).toBe(0);
      expect(migratedAsset.tags).toEqual(["scene"]);
    });

    it("Should default to revision 0 when legacy layer revision is missing", async () => {
      const sceneId = new ObjectId();
      const userId = new ObjectId();

      await scenesCollection.insertOne({
        _id: sceneId,
        user: userId,
        description: "legacy",
        detailContent: "path/to/detail.png",
      });

      const migratedCount = await migrateLegacySceneContentToAssets();
      expect(migratedCount).toBe(1);

      const migratedAsset = await assetsCollection.findOne({
        user: userId,
        name: `scene-${sceneId.toString()}-detail`,
      });
      expect(migratedAsset).toBeTruthy();
      if (!migratedAsset) {
        fail("Expected migrated detail asset to exist");
      }
      expect(migratedAsset.revision).toBe(0);
      expect(migratedAsset.tags).toEqual(["scene"]);
    });
  });
});
