process.env["DISABLE_AUTH"] = "true";
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

import { userZero, userOne } from "./assets/auth";
import { setupTestEnv, teardownTestEnv, TestEnv } from "./testenv";
const WebSocketClient = require("websocket").client;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let server: Server;
let env: TestEnv;

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
  (getOAuthPublicKey as jest.Mock).mockReturnValue(Promise.resolve("pubkey"));

  env = await setupTestEnv({ returnServer: true });
  app = env.app;
  server = env.server!;
});

afterAll(() => teardownTestEnv(env));

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
