process.env["DISABLE_AUTH"] = "true";
import request from "supertest";
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
import { Collection } from "mongodb";
import { userZero, userOne } from "./assets/auth";
import { fail } from "node:assert";
import { ScenelessTokenInstance } from "@micahg/tbltp-common";
import { setupTestEnv, teardownTestEnv, TestEnv } from "./testenv";
import {
  fetchDownload,
  uploadAssetData,
  uploadSceneOverlayData,
} from "./uploads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let shutDown: (signal: string) => void;
let env: TestEnv;
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

  await uploadAssetData(app, assetId);

  return request(app)
    .put(`/scene/${sceneId}/${layer}`)
    .send({ assetId });
}

jest.mock("../src/utils/auth");

jest.setTimeout(30000);

beforeAll(async () => {
  (getOAuthPublicKey as jest.Mock).mockReturnValue(Promise.resolve("pubkey"));

  env = await setupTestEnv();
  app = env.app;
  shutDown = env.shutDown;
  usersCollection = env.db.collection("users");
  scenesCollection = env.db.collection("scenes");
  assetsCollection = env.db.collection("assets");
  tokensCollection = env.db.collection("tokens");
  tokenInstancesCollection = env.db.collection("tokeninstances");
});

afterAll(() => teardownTestEnv(env));

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

  describe("overlay data", () => {
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

    it("Should 404 the overlay endpoints for an unknown scene", async () => {
      // ensure the calling user exists (the overlay routes 401 unknown users
      // before they can 404 unknown scenes)
      const scenes = await request(app).get("/scene");
      expect(scenes.statusCode).toBe(200);

      const presigned = await request(app)
        .post("/scene/aaaaaaaaaaaaaaaaaaaaaaaa/overlay/data")
        .send({ contentType: "image/png" });
      expect(presigned.statusCode).toBe(404);

      const commit = await request(app)
        .put("/scene/aaaaaaaaaaaaaaaaaaaaaaaa/overlay/data")
        .send({ contentType: "image/png" });
      expect(commit.statusCode).toBe(404);
    });

    it("Should 400 an invalid scene id or content type", async () => {
      const badId = await request(app)
        .post("/scene/asdf/overlay/data")
        .send({ contentType: "image/png" });
      expect(badId.statusCode).toBe(400);

      const badType = await request(app)
        .post("/scene/aaaaaaaaaaaaaaaaaaaaaaaa/overlay/data")
        .send({ contentType: "image/gif" });
      expect(badType.statusCode).toBe(400);
    });

    it("Should 400 when committing before the upload happened", async () => {
      const scenes = await request(app).get("/scene");
      expect(scenes.statusCode).toBe(200);
      const sceneId = scenes.body[0]._id;

      // presign but never upload the object
      const presigned = await request(app)
        .post(`/scene/${sceneId}/overlay/data`)
        .send({ contentType: "image/png" });
      expect(presigned.statusCode).toBe(200);

      const commit = await request(app)
        .put(`/scene/${sceneId}/overlay/data`)
        .send({ contentType: "image/png" });
      expect(commit.statusCode).toBe(400);
    });

    it("Should create and assign the overlay asset on the first update", async () => {
      const scenes = await request(app).get("/scene");
      expect(scenes.statusCode).toBe(200);
      const sceneId = scenes.body[0]._id;
      expect(scenes.body[0].overlayId).toBeFalsy(); // fresh scene

      const resp = await uploadSceneOverlayData(app, sceneId);
      expect(resp.statusCode).toBe(200);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.revision).toBe(1);
      expect(resp.body.location).toMatch(
        /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
      );

      // the scene-keyed endpoint created and assigned the overlay asset
      const updated = await request(app).get("/scene");
      expect(updated.statusCode).toBe(200);
      expect(updated.body[0].overlayId).toBe(resp.body._id);

      const asset = await assetsCollection.findOne({
        name: `scene ${sceneId} overlay`,
      });
      expect(asset).toBeTruthy();
      expect(asset.tags).toEqual(["scene"]);
    });

    it("Should serve overlay downloads with no-store Cache-Control", async () => {
      const scenes = await request(app).get("/scene");
      expect(scenes.statusCode).toBe(200);
      const sceneId = scenes.body[0]._id;

      const uploaded = await uploadSceneOverlayData(app, sceneId);
      expect(uploaded.statusCode).toBe(200);

      // the overlay is replaced at the same key on every annotation, so a
      // stale copy must never be served from a cache
      const fetched = await fetchDownload(app, uploaded.body.location);
      expect(fetched.status).toBe(200);
      expect(fetched.headers.get("content-type")).toBe("image/png");
      expect(fetched.headers.get("cache-control")).toBe("private, no-store");
    });

    it("Should allow repeated updates of the overlay asset", async () => {
      const scenes = await request(app).get("/scene");
      expect(scenes.statusCode).toBe(200);
      const sceneId = scenes.body[0]._id;

      const first = await uploadSceneOverlayData(app, sceneId);
      expect(first.statusCode).toBe(200);
      expect(first.body.revision).toBe(1);

      // the overlay is regenerated as the game master annotates, so the
      // same asset gets its data replaced on every stroke
      const second = await uploadSceneOverlayData(app, sceneId);
      expect(second.statusCode).toBe(200);
      expect(second.body.revision).toBe(2);
      expect(second.body._id).toBe(first.body._id);

      const updated = await request(app).get("/scene");
      expect(updated.body[0].overlayId).toBe(second.body._id);
    });

    it("Should update the overlay while the background stays immutable", async () => {
      const scenes = await request(app).get("/scene");
      expect(scenes.statusCode).toBe(200);
      const sceneId = scenes.body[0]._id;

      // give the scene a player background and a placed token -- the issue
      // #519 setup: replacing the background would invalidate the token
      // placement, but the annotation overlay keeps updating
      const playerResp = await assignSceneLayer(sceneId, "player");
      expect(playerResp.statusCode).toBe(200);

      const token = await request(app)
        .put("/token")
        .send({ name: "bystander" });
      expect(token.statusCode).toBe(201);
      const instance: Omit<ScenelessTokenInstance, "angle"> = {
        name: "bystander instance",
        token: token.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      };
      const placed = await request(app)
        .put(`/scene/${sceneId}/token`)
        .send(instance);
      expect(placed.statusCode).toBe(201);

      // the player background asset cannot be re-uploaded through the
      // asset data endpoints
      const updated = await request(app).get("/scene");
      const playerAssetId = updated.body[0].playerId;
      const refused = await request(app)
        .post(`/asset/${playerAssetId}/data`)
        .send({ contentType: "image/png" });
      expect(refused.statusCode).toBe(409);

      // the overlay keeps updating through the scene-keyed endpoint
      const resp = await uploadSceneOverlayData(app, sceneId);
      expect(resp.statusCode).toBe(200);
      expect(resp.body.revision).toBe(1);
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
