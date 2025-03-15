process.env["DISABLE_AUTH"] = "true";

import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";
import { app, serverPromise, shutDown, startUp } from "../src/server";

import * as request from "supertest";
import { userZero } from "./assets/auth";
import { stat } from "node:fs/promises";
import { ScenelessTokenInstance } from "@micahg/tbltp-common/src/tokeninstance";

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let assetsCollection: Collection;
let usersCollection: Collection;

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
      assetsCollection = db.collection("assets");

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

describe("asset", () => {
  // start each test with the zero user as the calling user
  describe("creation", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(async () => {
      await assetsCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
    it("Should get an empty list of assets when there are none", async () => {
      const url = `/asset`;
      let resp;
      try {
        resp = await request(app).get(url);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.length).toBe(0);
    });
    it("Should not create an empty asset", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should 400 when name is not provided", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({});
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should succeed when asset is created with name", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await assetsCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
    });
    it("Should 409 when two asset are created with the same name", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await assetsCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(409);
    });
  });
  describe("data upload", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(async () => {
      await assetsCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
    it("Should 400 when file is not provided", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Asset Creation Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const url = `/asset/${resp.body._id}/data`;
      try {
        resp = await request(app).put(url).send();
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should 400 when id is invalid", async () => {
      let resp;
      try {
        resp = await request(app)
          .put("/asset/zzzzzzzzzzzzzzzzzzzzzzzz/data")
          .attach("asset", "test/assets/1x1.png");
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should 404 when id is valid but does not exist", async () => {
      let resp;
      try {
        resp = await request(app)
          .put("/asset/aaaaaaaaaaaaaaaaaaaaaaaa/data")
          .attach("asset", "test/assets/1x1.png");
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(404);
    });
    it("Should succeed when a file is provided", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Asset Creation Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      try {
        resp = await request(app)
          .put(`/asset/${resp.body._id}/data`)
          .attach("asset", "test/assets/1x1.png");
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.location).toMatch(
        /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
      );
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await assetsCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
    });
  });
  describe("list", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(async () => {
      await assetsCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
    it("Should get the list of assets", async () => {
      const url = `/asset`;
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "FIRST_ASSET" });
      } catch (err) {
        fail(`Exception creating asset: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      try {
        resp = await request(app)
          .put(`/asset/${resp.body._id}/data`)
          .attach("asset", "test/assets/1x1.png");
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      try {
        resp = await request(app).put("/asset").send({ name: "SECOND_ASSET" });
      } catch (err) {
        fail(`Exception creating asset: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      try {
        resp = await request(app).get(url);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.length).toBe(2);
      expect(resp.body[0].name).toBe("FIRST_ASSET");
      expect(resp.body[0].location).toMatch(
        /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
      );
      expect(resp.body[1].name).toBe("SECOND_ASSET");
      expect(resp.body[1].location).not.toBeDefined();
    });
  });
  describe("update", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    it("Should update the asset name", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await assetsCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
      try {
        resp = await request(app)
          .put("/asset")
          .send({ _id: resp.body._id, name: "test2" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      const assets2 = await assetsCollection
        .find({ user: user!._id })
        .toArray();
      expect(assets2).toBeDefined();
      expect(assets2).not.toBeNull();
      expect(assets2).toHaveLength(1);
      expect(assets2[0].name).toBe("test2");
    });
    afterEach(async () => {
      await assetsCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
  });
  describe("delete", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(async () => {
      await assetsCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
    it("Should 404 when asset does not exist", async () => {
      let resp;
      try {
        resp = await request(app).delete("/asset/aaaaaaaaaaaaaaaaaaaaaaaa");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(404);
    });
    it("Should delete the asset", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await assetsCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
      try {
        resp = await request(app).delete(`/asset/${resp.body._id}`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(204);
      const assets2 = await assetsCollection
        .find({ user: user!._id })
        .toArray();
      expect(assets2).toBeDefined();
      expect(assets2).not.toBeNull();
      expect(assets2).toHaveLength(0);
    });
    it("Should delete the asset file", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await assetsCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);

      try {
        resp = await request(app)
          .put(`/asset/${resp.body._id}/data`)
          .attach("asset", "test/assets/1x1.png");
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.location).toMatch(
        /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
      );

      const filename = resp.body.location;
      expect((await stat(filename)).isFile()).toBe(true);

      try {
        resp = await request(app).delete(`/asset/${resp.body._id}`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(204);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        await stat(filename);
        fail(`File should not exist: ${filename}`);
      } catch {
        // expected
      }
    });
    describe("linked tokens", () => {
      it("Should delete associated tokens and token instances", async () => {
        const sceneResponse = await request(app).get("/scene");
        expect(sceneResponse.statusCode).toBe(200);

        const assetOne = await request(app)
          .put("/asset")
          .send({ name: "FIRST_ASSET" });
        expect(assetOne.statusCode).toBe(201);

        const assetTwo = await request(app)
          .put("/asset")
          .send({ name: "SECOND_ASSET" });
        expect(assetTwo.statusCode).toBe(201);

        expect(
          (
            await request(app)
              .put(`/asset/${assetOne.body._id}/data`)
              .attach("asset", "test/assets/1x1.png")
          ).statusCode,
        ).toBe(200);

        expect(
          (
            await request(app)
              .put(`/asset/${assetTwo.body._id}/data`)
              .attach("asset", "test/assets/1x1.png")
          ).statusCode,
        ).toBe(200);

        // create tokens
        const first = await request(app)
          .put("/token")
          .send({ name: "first", asset: assetOne.body._id });
        const second = await request(app)
          .put("/token")
          .send({ name: "second" });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);

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
        const firstResp = await request(app)
          .put(`/scene/${sceneResponse.body[0]._id}/token`)
          .send(firstInstance);
        expect(firstResp.statusCode).toBe(201);
        const secondResp = await request(app)
          .put(`/scene/${sceneResponse.body[0]._id}/token`)
          .send(secondInstance);
        expect(secondResp.statusCode).toBe(201);

        let tokens = await request(app).get(`/token`);
        expect(tokens.statusCode).toBe(200);
        expect(tokens.body.length).toBe(2);

        const url = `/scene/${sceneResponse.body[0]._id}/token`;
        let resp = await request(app).get(url);
        expect(resp.statusCode).toBe(200);
        expect(resp.body.length).toBe(2);
        expect(resp.body[0].token).toBe(first.body._id);
        expect(resp.body[1].token).toBe(second.body._id);
        // delete the first asset
        expect(
          (await request(app).delete(`/asset/${assetOne.body._id}`)).statusCode,
        ).toBe(204);

        tokens = await request(app).get(`/token`);
        expect(tokens.statusCode).toBe(200);
        expect(tokens.body.length).toBe(1);

        // there should only be one token instance based on the second token
        resp = await request(app).get(url);
        expect(resp.statusCode).toBe(200);
        expect(resp.body.length).toBe(1);
        expect(resp.body[0].token).toBe(second.body._id);
      });
    });
  });
});
