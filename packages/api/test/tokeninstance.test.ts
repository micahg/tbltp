process.env["DISABLE_AUTH"] = "true";

import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";
import { app, serverPromise, shutDown, startUp } from "../src/server";

import * as request from "supertest";
import { userOne, userZero } from "./assets/auth";
import { TokenInstance } from "@micahg/tbltp-common";

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let usersCollection,
  sceneCollection,
  tokensCollection,
  tokenInstancesCollection: Collection;

jest.mock("../src/utils/auth");

const minTokenInstance: TokenInstance = {
  name: "asdf",
  scene: "000000000000000000000000",
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
        resp = await request(app).put("/tokeninstance");
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
          resp = await request(app).put("/tokeninstance").send(inst);
        } catch (err) {
          fail(`Exception: ${JSON.stringify(err)}`);
        }
        expect(resp.statusCode).toBe(400);
      },
    );
    test.each(["scene", "token"])(
      "Should fail with invalid %s",
      async (key) => {
        let resp;
        try {
          const inst = { ...minTokenInstance };
          inst[key] = "asdf";
          resp = await request(app).put("/tokeninstance").send(inst);
        } catch (err) {
          fail(`Exception: ${JSON.stringify(err)}`);
        }
        expect(resp.statusCode).toBe(400);
      },
    );
    it("Should create a token instance", async () => {
      // create a scene
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

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
      };
      const resp = await request(app).put("/tokeninstance").send(inst);
      expect(resp.statusCode).toBe(201);

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
        const resp = await request(app).put("/tokeninstance").send({
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
        delete inst[key];

        const resp2 = await request(app).put("/tokeninstance").send(inst);
        expect(resp2.statusCode).toBe(400);
      },
    );
    test.each(["scene", "token"])(
      "Should fail with invalid %s",
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
        const resp = await request(app).put("/tokeninstance").send({
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
        inst[key] = "asdf";
        const resp2 = await request(app).put("/tokeninstance").send(inst);
        expect(resp2.statusCode).toBe(400);
      },
    );
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
      const resp = await request(app).put("/tokeninstance").send({
        name: "test",
        token: tokenResp1.body._id,
        scene: sceneResp.body[0]._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      });
      expect(resp.statusCode).toBe(201);

      const inst = {
        _id: resp.body._id,
        ...updatedMinTokenInstance,
        scene: sceneResp.body[0]._id,
        token: tokenResp2.body._id,
      };
      const resp2 = await request(app).put("/tokeninstance").send(inst);
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
  // describe("list", () => {
  //   beforeEach(async () => {
  //     (getFakeUser as jest.Mock).mockReturnValue(userZero);
  //   });
  //   afterEach(async () => {
  //     await tokensCollection.deleteMany({}); // Clean up the database
  //     await usersCollection.deleteMany({}); // Clean up the database
  //   });
  //   it("Should get the list of tokens", async () => {
  //     let resp;
  //     try {
  //       resp = await request(app)
  //         .put("/token")
  //         .send({ name: "first", visible: true, hitPoints: 99 });
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(201);
  //     expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
  //     expect(resp.body.name).toBe("first");
  //     expect(resp.body.hitPoints).toBe(99);
  //     expect(resp.body.visible).toBe(true);
  //     try {
  //       resp = await request(app).put("/token").send({ name: "second" });
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(201);
  //     expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
  //     expect(resp.body.name).toBe("second");
  //     expect(resp.body.hitPoints).toBeUndefined();
  //     expect(resp.body.visible).toBe(false);

  //     try {
  //       resp = await request(app).get("/token");
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(200);
  //     expect(resp.body.length).toBe(2);
  //     expect(resp.body[0].name).toBe("first");
  //     expect(resp.body[0].hitPoints).toBe(99);
  //     expect(resp.body[0].visible).toBe(true);
  //     expect(resp.body[1].name).toBe("second");
  //     expect(resp.body[1].hitPoints).toBeUndefined();
  //     expect(resp.body[1].visible).toBe(false);
  //   });
  // });
  // describe("delete", () => {
  //   beforeEach(async () => {
  //     (getFakeUser as jest.Mock).mockReturnValue(userZero);
  //   });
  //   afterEach(async () => {
  //     await tokensCollection.deleteMany({}); // Clean up the database
  //     await usersCollection.deleteMany({}); // Clean up the database
  //   });
  //   it("Should not delete someone elses token", async () => {
  //     let resp;
  //     try {
  //       resp = await request(app).put("/token").send({ name: "test" });
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(201);
  //     expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
  //     expect(resp.body.name).toBe("test");
  //     const user = await usersCollection.findOne({ sub: userZero });
  //     expect(user).toBeDefined();
  //     expect(user).not.toBeNull();
  //     const tokens = await tokensCollection.find({ user: user!._id }).toArray();
  //     expect(tokens).toBeDefined();
  //     expect(tokens).not.toBeNull();
  //     expect(tokens).toHaveLength(1);
  //     (getFakeUser as jest.Mock).mockReturnValue(userOne);
  //     try {
  //       resp = await request(app).delete(`/token/${resp.body._id}`).send();
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(404);
  //   });
  //   it("Should delete a tokens", async () => {
  //     let resp;
  //     try {
  //       resp = await request(app)
  //         .put("/token")
  //         .send({ name: "first", visible: true, hitPoints: 99 });
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(201);
  //     expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
  //     expect(resp.body.name).toBe("first");
  //     expect(resp.body.hitPoints).toBe(99);
  //     expect(resp.body.visible).toBe(true);
  //     try {
  //       resp = await request(app).put("/token").send({ name: "second" });
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(201);
  //     expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
  //     expect(resp.body.name).toBe("second");
  //     expect(resp.body.hitPoints).toBeUndefined();
  //     expect(resp.body.visible).toBe(false);
  //     try {
  //       resp = await request(app)
  //         .put("/token")
  //         .send({ name: "third", hitPoints: 10 });
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(201);
  //     expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
  //     expect(resp.body.name).toBe("third");
  //     expect(resp.body.hitPoints).toBe(10);
  //     expect(resp.body.visible).toBe(false);
  //     try {
  //       resp = await request(app).get("/token");
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(200);
  //     expect(resp.body.length).toBe(3);
  //     expect(resp.body[0].name).toBe("first");
  //     expect(resp.body[0].hitPoints).toBe(99);
  //     expect(resp.body[0].visible).toBe(true);
  //     expect(resp.body[1].name).toBe("second");
  //     expect(resp.body[1].hitPoints).toBeUndefined();
  //     expect(resp.body[1].visible).toBe(false);
  //     expect(resp.body[2].name).toBe("third");
  //     expect(resp.body[2].hitPoints).toBe(10);
  //     expect(resp.body[2].visible).toBe(false);
  //     try {
  //       resp = await request(app).delete(`/token/${resp.body[1]._id}`);
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(204);

  //     try {
  //       resp = await request(app).get("/token");
  //     } catch (err) {
  //       fail(`Exception: ${JSON.stringify(err)}`);
  //     }
  //     expect(resp.statusCode).toBe(200);
  //     expect(resp.body.length).toBe(2);
  //     expect(resp.body[0].name).toBe("first");
  //     expect(resp.body[0].hitPoints).toBe(99);
  //     expect(resp.body[0].visible).toBe(true);
  //     expect(resp.body[1].name).toBe("third");
  //     expect(resp.body[1].hitPoints).toBe(10);
  //     expect(resp.body[1].visible).toBe(false);
  //   });
  // });
});
