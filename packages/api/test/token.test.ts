process.env["DISABLE_AUTH"] = "true";

import { BSON, Collection, MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";
import { app, serverPromise, shutDown, startUp } from "../src/server";

import * as request from "supertest";
import { userOne, userZero } from "./assets/auth";
import { ScenelessTokenInstance } from "@micahg/tbltp-common";

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let tokensCollection: Collection;
let usersCollection: Collection;
let assetsCollection: Collection;

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
      tokensCollection = db.collection("tokens");
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

describe("token", () => {
  // start each test with the zero user as the calling user
  describe("creation", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(async () => {
      await tokensCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
    it("Should not create an empty asset", async () => {
      let resp;
      try {
        resp = await request(app).put("/token");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should not create a token without a name", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({});
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should not create a token without a name", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({});
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should create a token with a name", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      expect(resp.body.hitPoints).toBeUndefined();
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(resp.body.user).toBe(user!._id.toString());
      const tokens = await tokensCollection.find({ user: user!._id }).toArray();
      expect(tokens).toBeDefined();
      expect(tokens).not.toBeNull();
      expect(tokens).toHaveLength(1);
    });
    it("Should fail with someone elses asset", async () => {
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

      // switch to a different user and create a token with the asset
      (getFakeUser as jest.Mock).mockReturnValue(userOne);
      try {
        resp = await request(app)
          .put("/token")
          .send({ name: "test", asset: resp.body._id });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
  });
  describe("update", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    it("Should update the token name", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await tokensCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
      try {
        resp = await request(app).put("/token").send({
          _id: resp.body._id,
          name: "test2",
          visible: true,
          hitPoints: 10,
        });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      const assets2 = await tokensCollection
        .find({ user: user!._id })
        .toArray();
      expect(assets2).toBeDefined();
      expect(assets2).not.toBeNull();
      expect(assets2).toHaveLength(1);
      expect(assets2[0].name).toBe("test2");
      expect(assets2[0].hitPoints).toBe(10);
    });
    it("Should fail to update someone elses token", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const tokens = await tokensCollection.find({ user: user!._id }).toArray();
      expect(tokens).toBeDefined();
      expect(tokens).not.toBeNull();
      expect(tokens).toHaveLength(1);

      (getFakeUser as jest.Mock).mockReturnValue(userOne);
      try {
        resp = await request(app).put("/token").send({
          _id: resp.body._id,
          name: "test2",
          hitPoints: 10,
          asset: resp.body._id,
        });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should fail to update the token to someone elses asset", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const tokens = await tokensCollection.find({ user: user!._id }).toArray();
      expect(tokens).toBeDefined();
      expect(tokens).not.toBeNull();
      expect(tokens).toHaveLength(1);

      (getFakeUser as jest.Mock).mockReturnValue(userOne);
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }

      (getFakeUser as jest.Mock).mockReturnValue(userZero);
      try {
        resp = await request(app).put("/token").send({
          _id: resp.body._id,
          name: "test2",
          visible: true,
          hitPoints: 10,
          asset: resp.body._id,
        });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });

    it("Should update the token asset", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      const tokenId = resp.body._id as string;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      const assetId = resp.body._id;
      try {
        resp = await request(app).put("/token").send({
          _id: tokenId,
          name: "test",
          asset: assetId,
        });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      const allTokens = await tokensCollection.find({}).toArray();
      console.log(allTokens);
      const token = await tokensCollection.findOne({
        _id: { $eq: new BSON.ObjectId(tokenId) },
      });
      expect(token).toBeDefined();
      expect(token?.asset.toString()).toBe(assetId);
    });
    it("Should delete the token asset", async () => {
      let resp;

      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      const assetId = resp.body._id;

      try {
        resp = await request(app)
          .put("/token")
          .send({ name: "test", asset: assetId, hitPoints: 10 });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      const tokenId = resp.body._id as string;
      let token = await tokensCollection.findOne({
        _id: { $eq: new BSON.ObjectId(tokenId) },
      });
      expect(token).toBeDefined();
      expect(token?.hitPoints).toBe(10);
      expect(token?.asset.toString()).toBe(assetId);

      try {
        resp = await request(app).put("/token").send({
          _id: tokenId,
          name: "test",
        });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }

      token = await tokensCollection.findOne({
        _id: { $eq: new BSON.ObjectId(tokenId) },
      });
      expect(token).toBeDefined();
      expect(token!.hitPoints).toBeUndefined();
      expect(token!.asset).toBeUndefined();
    });
    afterEach(async () => {
      await tokensCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
      await assetsCollection.deleteMany({}); // Clean up the database
    });
  });
  describe("list", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(async () => {
      await tokensCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
    it("Should get the list of tokens", async () => {
      let resp;
      try {
        resp = await request(app)
          .put("/token")
          .send({ name: "first", visible: true, hitPoints: 99 });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("first");
      expect(resp.body.hitPoints).toBe(99);
      try {
        resp = await request(app).put("/token").send({ name: "second" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("second");
      expect(resp.body.hitPoints).toBeUndefined();

      try {
        resp = await request(app).get("/token");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.length).toBe(2);
      expect(resp.body[0].name).toBe("first");
      expect(resp.body[0].hitPoints).toBe(99);
      expect(resp.body[1].name).toBe("second");
      expect(resp.body[1].hitPoints).toBeUndefined();
    });
  });
  describe("delete", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(async () => {
      await tokensCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
    it("Should not delete someone elses token", async () => {
      let resp;
      try {
        resp = await request(app).put("/token").send({ name: "test" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const tokens = await tokensCollection.find({ user: user!._id }).toArray();
      expect(tokens).toBeDefined();
      expect(tokens).not.toBeNull();
      expect(tokens).toHaveLength(1);
      (getFakeUser as jest.Mock).mockReturnValue(userOne);
      try {
        resp = await request(app).delete(`/token/${resp.body._id}`).send();
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(404);
    });
    it("Should delete a tokens", async () => {
      let resp;
      try {
        resp = await request(app)
          .put("/token")
          .send({ name: "first", visible: true, hitPoints: 99 });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("first");
      expect(resp.body.hitPoints).toBe(99);
      try {
        resp = await request(app).put("/token").send({ name: "second" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("second");
      expect(resp.body.hitPoints).toBeUndefined();
      try {
        resp = await request(app)
          .put("/token")
          .send({ name: "third", hitPoints: 10 });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("third");
      expect(resp.body.hitPoints).toBe(10);
      try {
        resp = await request(app).get("/token");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.length).toBe(3);
      expect(resp.body[0].name).toBe("first");
      expect(resp.body[0].hitPoints).toBe(99);
      expect(resp.body[1].name).toBe("second");
      expect(resp.body[1].hitPoints).toBeUndefined();
      expect(resp.body[2].name).toBe("third");
      expect(resp.body[2].hitPoints).toBe(10);
      try {
        resp = await request(app).delete(`/token/${resp.body[1]._id}`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(204);

      try {
        resp = await request(app).get("/token");
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.length).toBe(2);
      expect(resp.body[0].name).toBe("first");
      expect(resp.body[0].hitPoints).toBe(99);
      expect(resp.body[1].name).toBe("third");
      expect(resp.body[1].hitPoints).toBe(10);
    });
    describe("linked token instances", () => {
      it("Should delete associated instance tokens", async () => {
        // create scene
        const sceneResponse = await request(app).get("/scene");
        expect(sceneResponse.statusCode).toBe(200);

        // create tokens
        const first = await request(app).put("/token").send({ name: "first" });
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

        // delete the token
        await request(app).delete(`/token/${first.body._id}`);

        // there should only be one token instance based on the second token
        const url = `/scene/${sceneResponse.body[0]._id}/token`;
        const resp = await request(app).get(url);
        expect(resp.statusCode).toBe(200);
        expect(resp.body.length).toBe(1);
        expect(resp.body[0].token).toBe(second.body._id);
      });
    });
  });
});
