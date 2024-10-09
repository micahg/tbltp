process.env["DISABLE_AUTH"] = "true";

import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";
import { app, serverPromise, shutDown, startUp } from "../src/server";

import * as request from "supertest";
import { userZero } from "./assets/auth";

let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
// let assetsCollection: Collection;
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
  beforeEach(() => {
    (getFakeUser as jest.Mock).mockReturnValue(userZero);
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
      resp = await request(app)
        .put("/asset")
        .attach("asset", "test/assets/1x1.png"); // Sending an empty object
    } catch (err) {
      fail(`Exception: ${JSON.stringify(err)}`);
    }
    expect(resp.statusCode).toBe(400);
  });
  it("Should 400 when file is not provided", async () => {
    let resp;
    try {
      resp = await request(app).put("/asset").field("name", "test"); // Sending an empty object
    } catch (err) {
      fail(`Exception: ${JSON.stringify(err)}`);
    }
    expect(resp.statusCode).toBe(400);
  });
  it("Should succeed when a name and file are provided", async () => {
    const url = `/asset`;
    let resp;
    try {
      resp = await request(app)
        .put(url)
        .field("name", "FIRST_ASSET")
        .attach("asset", "test/assets/1x1.png");
    } catch (err) {
      fail(`Exception: ${JSON.stringify(err)}`);
    }
    expect(resp.statusCode).toBe(200);
    expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
    expect(resp.body.name).toBe("FIRST_ASSET");
    expect(resp.body.location).toMatch(
      /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
    );
  });
});
