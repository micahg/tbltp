process.env["DISABLE_AUTH"] = "true";

import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";
import { app, serverPromise, shutDown, startUp } from "../src/server";

import * as request from "supertest";
import { userOne, userZero } from "./assets/auth";
import { ScenelessTokenInstance, TokenInstance } from "@micahg/tbltp-common";

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let usersCollection,
  sceneCollection,
  tokensCollection,
  tokenInstancesCollection: Collection;

jest.mock("../src/utils/auth");

type SceneToken = Omit<ScenelessTokenInstance, "angle">;

const minTokenInstance: SceneToken = {
  name: "asdf",
  token: "000000000000000000000000",
  x: 0,
  y: 0,
  scale: 1,
  visible: true,
};

const updatedMinTokenInstance: TokenInstance = {
  name: "qwer",
  scene: "111111111111111111111111",
  token: "111111111111111111111111",
  x: 1,
  y: 1,
  scale: 2,
  visible: false,
  angle: 0,
};

beforeAll((done) => {
  // mongo 7 needs wild tiger
  MongoMemoryServer.create({ instance: { storageEngine: "wiredTiger" } }).then(
    (mongo) => {
      mongodb = mongo;
      process.env["MONGO_URL"] = `${mongo.getUri()}ntt`;
      mongocl = new MongoClient(process.env["MONGO_URL"]);
      const db = mongocl.db("ntt");
      usersCollection = db.collection("users");
      sceneCollection = db.collection("scenes");
      tokensCollection = db.collection("tokens");
      tokenInstancesCollection = db.collection("tokeninstances");

      (getOAuthPublicKey as jest.Mock).mockReturnValue(
        Promise.resolve("pubkey"),
      );

      startUp();
      serverPromise
        .then(() => {
          //(srvr) => {
          // server = srvr;
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

describe("token instance", () => {
  // start each test with the zero user as the calling user
  beforeEach(async () => {
    (getFakeUser as jest.Mock).mockReturnValue(userZero);
    await tokensCollection.deleteMany({}); // Clean up the database
    await usersCollection.deleteMany({}); // Clean up the database
    await tokenInstancesCollection.deleteMany({}); // Clean up the database
    await sceneCollection.deleteMany({}); // Clean up the database
  });
  afterEach(async () => {
    await tokensCollection.deleteMany({}); // Clean up the database
    await usersCollection.deleteMany({}); // Clean up the database
    await tokenInstancesCollection.deleteMany({}); // Clean up the database
    await sceneCollection.deleteMany({}); // Clean up the database
  });
  describe("creation", () => {
    it("Should not create an empty token instance", async () => {
      let resp;
      try {
        resp = await request(app).put(`/scene/000000000000000000000000/token`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    test.each(Object.keys(minTokenInstance))(
      "Should fail with %s missing",
      async (key) => {
        let resp;
        try {
          const inst = { ...minTokenInstance };
          delete inst[key];
          resp = await request(app)
            .put(`/scene/000000000000000000000000/token`)
            .send(inst);
        } catch (err) {
          fail(`Exception: ${JSON.stringify(err)}`);
        }
        expect(resp.statusCode).toBe(400);
      },
    );
    it("should fail with an invalid scene", async () => {
      const resp = await request(app)
        .put("/scene/asdf/token")
        .send(minTokenInstance);
      expect(resp.statusCode).toBe(400);
    });
    it("should fail with an invalid token", async () => {
      const inst = { ...minTokenInstance };
      inst["token"] = "asdf";
      const resp = await request(app)
        .put(`/scene/000000000000000000000000/token`)
        .send(inst);
      expect(resp.statusCode).toBe(400);
    });
    it("Should create a token instance", async () => {
      // create a scene
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      const inst: SceneToken = {
        name: "test",
        token: tokenResponse.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      };
      const resp = await request(app)
        .put(`/scene/${sceneResponse.body[0]._id}/token`)
        .send(inst);
      expect(resp.statusCode).toBe(201);

      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      expect(resp.body.hitPoints).toBeUndefined();
      expect(resp.body.visible).toBe(true);
    });
    it("Should fail with someone elses token", async () => {
      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      // switch to a different user and create a token with the asset
      (getFakeUser as jest.Mock).mockReturnValue(userOne);

      // create a scene
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

      const inst: TokenInstance = {
        name: "test",
        token: tokenResponse.body._id,
        scene: sceneResponse.body[0]._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
        angle: 0,
      };
      const resp = await request(app).put("/tokeninstance").send(inst);
      expect(resp.statusCode).toBe(404);
    });
    it("Should fail with someone elses scene", async () => {
      // create a scene
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

      // switch to a different user and create a token with the asset
      (getFakeUser as jest.Mock).mockReturnValue(userOne);

      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      const inst: TokenInstance = {
        name: "test",
        token: tokenResponse.body._id,
        scene: sceneResponse.body[0]._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
        angle: 0,
      };
      const resp = await request(app).put("/tokeninstance").send(inst);
      expect(resp.statusCode).toBe(404);
    });
  });
  describe("update", () => {
    test.each(Object.keys(minTokenInstance))(
      "Should fail with %s missing",
      async (key) => {
        // create a scene
        const sceneResponse = await request(app).get("/scene");
        expect(sceneResponse.statusCode).toBe(200);

        // create a token
        const tokenResponse = await request(app)
          .put("/token")
          .send({ name: "test" });
        expect(tokenResponse.statusCode).toBe(201);

        // create the token instance
        const resp = await request(app)
          .put(`/scene/${sceneResponse.body[0]._id}/token`)
          .send({
            name: "test",
            token: tokenResponse.body._id,
            x: 0,
            y: 0,
            scale: 1,
            visible: true,
          });
        expect(resp.statusCode).toBe(201);

        const inst = { ...resp.body };
        delete inst[key];

        const resp2 = await request(app)
          .put(`/scene/${sceneResponse.body[0]._id}/token`)
          .send(inst);
        expect(resp2.statusCode).toBe(400);
      },
    );
    it("should fail with invalid scene", async () => {
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      // create the token instance
      const resp = await request(app)
        .put(`/scene/${sceneResponse.body[0]._id}/token`)
        .send({
          name: "test",
          token: tokenResponse.body._id,
          scene: sceneResponse.body[0]._id,
          x: 0,
          y: 0,
          scale: 1,
          visible: true,
        });
      expect(resp.statusCode).toBe(201);

      const inst = { ...resp.body };
      const resp2 = await request(app).put(`/scene/asdf/token`).send(inst);
      expect(resp2.statusCode).toBe(400);
    });
    it("should fail with invalid token", async () => {
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      // create the token instance
      const resp = await request(app)
        .put(`/scene/${sceneResponse.body[0]._id}/token`)
        .send({
          name: "test",
          token: tokenResponse.body._id,
          x: 0,
          y: 0,
          scale: 1,
          visible: true,
        });
      expect(resp.statusCode).toBe(201);

      const inst = { ...resp.body, token: "asdf" };
      const resp2 = await request(app)
        .put(`/scene/${sceneResponse.body[0]._id}/token`)
        .send(inst);
      expect(resp2.statusCode).toBe(400);
    });
    it("Should update a token instance", async () => {
      // create a scene
      const sceneResp = await request(app).get("/scene");
      expect(sceneResp.statusCode).toBe(200);

      // create a token
      const tokenResp1 = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResp1.statusCode).toBe(201);

      const tokenResp2 = await request(app)
        .put("/token")
        .send({ name: "test2" });
      expect(tokenResp1.statusCode).toBe(201);

      // create the token instance
      const resp = await request(app)
        .put(`/scene/${sceneResp.body[0]._id}/token`)
        .send({
          name: "test",
          token: tokenResp1.body._id,
          x: 0,
          y: 0,
          scale: 1,
          visible: true,
        });
      expect(resp.statusCode).toBe(201);

      const inst = {
        _id: resp.body._id,
        ...updatedMinTokenInstance,
        token: tokenResp2.body._id,
      };
      const resp2 = await request(app)
        .put(`/scene/${sceneResp.body[0]._id}/token`)
        .send(inst);
      expect(resp2.statusCode).toBe(200);
      expect(resp2.body._id).toBe(resp.body._id);
      expect(resp2.body.name).toBe("qwer");
      expect(resp2.body.scene).toBe(inst.scene);
      expect(resp2.body.token).toBe(inst.token);
      expect(resp2.body.x).toBe(1);
      expect(resp2.body.y).toBe(1);
      expect(resp2.body.scale).toBe(2);
      expect(resp2.body.visible).toBe(false);
    });
  });
  describe("list", () => {
    it("Should 400 on invalid scene", async () => {
      const resp = await request(app).get("/scene/asdf/token");
      expect(resp.statusCode).toBe(400);
    });
    it("Should return an empty list on an unknown scene", async () => {
      const resp = await request(app).get(
        "/scene/000000000000000000000000/token",
      );
      expect(resp.statusCode).toBe(200);
      expect(resp.body).toHaveLength(0);
      expect(resp.body).toEqual([]);
    });
    it("Should return a list of token instances", async () => {
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);
      const url = `/scene/${sceneResponse.body[0]._id}/token`;

      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      // create the token instance
      const resp1 = await request(app).put(url).send({
        name: "one",
        token: tokenResponse.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      });
      expect(resp1.statusCode).toBe(201);

      const resp2 = await request(app).put(url).send({
        name: "two",
        token: tokenResponse.body._id,
        x: 1,
        y: 1,
        scale: 2,
        visible: false,
      });
      expect(resp2.statusCode).toBe(201);

      const resp = await request(app).get(url);
      expect(resp.statusCode).toBe(200);
      expect(resp.body).toHaveLength(2);
      expect(resp.body[0]._id).toBe(resp1.body._id);
      expect(resp.body[0].name).toBe("one");
      expect(resp.body[0].x).toBe(0);
      expect(resp.body[0].y).toBe(0);
      expect(resp.body[0].scale).toBe(1);
      expect(resp.body[0].visible).toBe(true);
      expect(resp.body[1]._id).toBe(resp2.body._id);
      expect(resp.body[1].name).toBe("two");
      expect(resp.body[1].x).toBe(1);
      expect(resp.body[1].y).toBe(1);
      expect(resp.body[1].scale).toBe(2);
      expect(resp.body[1].visible).toBe(false);
    });
  });
  describe("delete", () => {
    it("Should 404 on a missing token instance", async () => {
      const resp2 = await request(app).delete(
        `/tokeninstance/000000000000000000000000`,
      );
      expect(resp2.statusCode).toBe(404);
    });
    it("Should 400 on an invalid token instance id", async () => {
      const resp2 = await request(app).delete(`/tokeninstance/asdf`);
      expect(resp2.statusCode).toBe(400);
    });
    it("Should not delete someone elses token instance", async () => {
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);
      const url = `/scene/${sceneResponse.body[0]._id}/token`;

      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      // create the token instance
      const resp1 = await request(app).put(url).send({
        name: "one",
        token: tokenResponse.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      });
      expect(resp1.statusCode).toBe(201);

      // switch to a different user and create a token with the asset
      (getFakeUser as jest.Mock).mockReturnValue(userOne);

      const resp2 = await request(app).delete(
        `/tokeninstance/${resp1.body._id}`,
      );
      expect(resp2.statusCode).toBe(404);
    });
    it("Should delete a token instance", async () => {
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);
      const url = `/scene/${sceneResponse.body[0]._id}/token`;

      // create a token
      const tokenResponse = await request(app)
        .put("/token")
        .send({ name: "test" });
      expect(tokenResponse.statusCode).toBe(201);

      // create the token instance
      const resp1 = await request(app).put(url).send({
        name: "one",
        token: tokenResponse.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      });
      expect(resp1.statusCode).toBe(201);

      const resp2 = await request(app).delete(
        `/tokeninstance/${resp1.body._id}`,
      );
      expect(resp2.statusCode).toBe(204);
    });
  });
});
