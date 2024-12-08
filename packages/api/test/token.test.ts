process.env["DISABLE_AUTH"] = "true";

import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";
import { app, serverPromise, shutDown, startUp } from "../src/server";

import * as request from "supertest";
import { userOne, userZero } from "./assets/auth";

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let tokensCollection: Collection;
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
      tokensCollection = db.collection("tokens");

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
      expect(resp.body.visible).toBe(false);
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
      expect(assets2[0].visible).toBe(true);
      expect(assets2[0].hitPoints).toBe(10);
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
      const assets = await tokensCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
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
    afterEach(async () => {
      await tokensCollection.deleteMany({}); // Clean up the database
      await usersCollection.deleteMany({}); // Clean up the database
    });
  });
  // describe("list", () => {
  //   it("Should get an empty list of assets when there are none", async () => {
  //     const url = `/token`;
  //     let resp;
  //     try {
  //       resp = await request(app).get(url);
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(200);
  //     expect(resp.body.length).toBe(0);
  //   });
  // });
});
