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
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";

import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Collection } from "mongodb";
import { userZero } from "./assets/auth";

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
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

      (getOAuthPublicKey as jest.Mock).mockReturnValue(
        Promise.resolve("pubkey"),
      );

      startUp();
      serverPromise
        .then(() => done())
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
