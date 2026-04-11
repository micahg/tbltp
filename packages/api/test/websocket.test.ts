process.env["DISABLE_AUTH"] = "true";
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
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
import { MongoClient } from "mongodb";
import { userZero, userOne } from "./assets/auth";
const WebSocketClient = require("websocket").client;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let shutDown: (signal: string) => void;
let mongodb: MongoMemoryServer;
let mongocl: MongoClient;
let server: Server;
let s3: S3Client;
let bucket: string;

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

  return request(app).put(`/scene/${sceneId}/${layer}`).send({ assetId });
}

function wsUrl(bearer: string) {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server address unavailable for websocket tests");
  }

  return `ws://localhost:${address.port}?bearer=${bearer}`;
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

  (getOAuthPublicKey as jest.Mock).mockReturnValue(Promise.resolve("pubkey"));

  // Dynamic import AFTER env vars are set so S3StorageDriver reads the correct config
  const serverModule = await import("../src/server");
  app = serverModule.app;
  shutDown = serverModule.shutDown;

  serverModule.startUp();
  server = await serverModule.serverPromise;
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

  it("Should close without data for an unknown user", (done) => {
    const client = new WebSocketClient();
    client.on("connect", (conn) => {
      conn.on("message", (msg) =>
        expect(msg.utf8Data).toBe('{"method":"error","info":"INVALID_USER"}'),
      );
      conn.on("close", () => done());
      conn.on("error", () => {
        throw new Error("Socket error when it should have closed");
      });
    });
    client.connect(wsUrl("asdf"), "echo-protocol");
  });

  it("Should create scenes", async () => {
    const sceneOneId = (await request(app).get("/scene")).body[0]._id;
    await request(app).put("/state").send({ scene: sceneOneId });
    await assignSceneLayer(sceneOneId, "player");

    (getFakeUser as jest.Mock).mockReturnValue(userOne);

    const sceneTwoId = (await request(app).get("/scene")).body[0]._id;
    await request(app).put("/state").send({ scene: sceneTwoId });
    await assignSceneLayer(sceneTwoId, "player");

    expect(sceneOneId).not.toBe(sceneTwoId);
  });

  it("Should handle a websocket connection", (done) => {
    const client = new WebSocketClient();
    client.on("connect", (conn) => {
      conn.on("message", (msg) => {
        try {
          expect(msg).toHaveProperty("utf8Data");
          const data = JSON.parse(msg.utf8Data);
          expect(data.method).toBe("connection");
        } finally {
          conn.close();
        }
      });
      conn.on("close", () => done());
    });
    client.connect(wsUrl("asdf"), "echo-protocol");
  });

  it("Should close the first connection if the same user opens a second", (done) => {
    const client = new WebSocketClient();
    let connCount = 0;
    let closeCount = 0;
    client.on("connect", (conn) => {
      conn.on("message", (msg) => {
        connCount++;
        expect(msg).toHaveProperty("utf8Data");
        const data = JSON.parse(msg.utf8Data);
        expect(data.method).toBe("connection");
        if (connCount === 2) conn.close();
      });
      conn.on("close", () => {
        closeCount++;
        if (closeCount === 2) {
          console.log("SECOND SOCKET CLOSED AS EXPECTED");
          done();
        } else console.log("FIRST SOCKET CLOSED AS EXPECTED");
      });
    });
    client.connect(wsUrl("asdf"), "echo-protocol");
    setTimeout(() => {
      client.connect(wsUrl("qwer"), "echo-protocol");
    }, 250);
  });

  it("Should handle a websocket connection", (done) => {
    let closeCount = 0;
    const client = new WebSocketClient();
    client.on("connect", (conn) => {
      conn.on("message", (msg) => {
        try {
          expect(msg).toHaveProperty("utf8Data");
          const data = JSON.parse(msg.utf8Data);
          expect(data.method).toBe("connection");
          expect(data.state.background).toMatch(/public.*\/assets\/.*\.png/);
        } finally {
          conn.close();
        }
      });
      conn.on("close", () => {
        closeCount++;
        if (closeCount === 2) done();
      });
    });
    client.connect(wsUrl("asdf"), "echo-protocol");
    setTimeout(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userOne);
      client.connect(wsUrl("qwer"), "echo-protocol");
    }, 250);
  });
});
