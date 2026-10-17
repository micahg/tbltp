process.env["DISABLE_AUTH"] = "true";

import { readFile } from "node:fs/promises";
import { Collection, ObjectId } from "mongodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getFakeUser, getOAuthPublicKey } from "../src/utils/auth";
import { setupTestEnv, teardownTestEnv, TestEnv } from "./testenv";

import * as request from "supertest";
import { userOne, userZero } from "./assets/auth";
import { createDownloadUrl, fetchDownload, uploadAssetData } from "./uploads";
import { ScenelessTokenInstance } from "@micahg/tbltp-common/src/tokeninstance";

let env: TestEnv;
let assetsCollection: Collection;
let usersCollection: Collection;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let shutDown: (signal: string) => void;
let deletePublicAsset: (location: string) => Promise<void>;
let objectExists: (key: string) => Promise<boolean>;

async function cleanupStoredAssets() {
  const assets = await assetsCollection
    .find({}, { projection: { location: 1 } })
    .toArray();

  await Promise.all(
    assets.map(async (asset) => {
      if (!asset.location) return;
      await deletePublicAsset(asset.location);
    }),
  );
}

/**
 * Fetch the raw bytes of a stored object straight from object storage.
 */
async function getObjectBytes(key: string): Promise<Buffer> {
  const result = await env.s3.send(
    new GetObjectCommand({ Bucket: env.bucket, Key: key }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = await (result.Body as any).transformToByteArray();
  return Buffer.from(bytes);
}

async function cleanupTestData() {
  await cleanupStoredAssets();
  await assetsCollection.deleteMany({});
  await usersCollection.deleteMany({});
}

jest.mock("../src/utils/auth");

jest.setTimeout(30000);

beforeAll(async () => {
  (getOAuthPublicKey as jest.Mock).mockReturnValue(Promise.resolve("pubkey"));

  env = await setupTestEnv();
  app = env.app;
  shutDown = env.shutDown;
  usersCollection = env.db.collection("users");
  assetsCollection = env.db.collection("assets");

  const storageModule = await import("../src/utils/s3store");
  deletePublicAsset = storageModule.deletePublicAsset;
  objectExists = storageModule.objectExists;
});

afterAll(() => teardownTestEnv(env));

describe("asset", () => {
  // start each test with the zero user as the calling user
  describe("creation", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(cleanupTestData);
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
    afterEach(cleanupTestData);
    it("Should 400 when the content type is missing", async () => {
      let resp;
      try {
        resp = await request(app)
          .put("/asset/aaaaaaaaaaaaaaaaaaaaaaaa/data")
          .send({});
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should 400 when the content type is invalid", async () => {
      let resp;
      try {
        resp = await request(app)
          .put("/asset/aaaaaaaaaaaaaaaaaaaaaaaa/data")
          .send({ contentType: "image/gif" });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should 400 when id is invalid", async () => {
      let resp;
      try {
        resp = await request(app)
          .post("/asset/zzzzzzzzzzzzzzzzzzzzzzzz/data")
          .send({ contentType: "image/png" });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should 404 when id is valid but does not exist", async () => {
      let resp;
      try {
        resp = await request(app)
          .post("/asset/aaaaaaaaaaaaaaaaaaaaaaaa/data")
          .send({ contentType: "image/png" });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(404);
    });
    it("Should 400 when committing before the upload happened", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Asset Creation Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      const url = `/asset/${resp.body._id}/data`;
      try {
        // presign but never upload the object
        resp = await request(app).post(url).send({ contentType: "image/png" });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      try {
        resp = await request(app)
          .put(url)
          .send({ contentType: "image/png" });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(400);
    });
    it("Should succeed with the presigned upload flow", async () => {
      let resp;
      try {
        resp = await request(app).put("/asset").send({ name: "test" });
      } catch (err) {
        fail(`Asset Creation Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(201);
      expect(resp.body._id).toMatch(/[a-f0-9]{24}/);
      expect(resp.body.name).toBe("test");

      // step 1: request the presigned upload url
      const assetId = resp.body._id;
      try {
        resp = await request(app)
          .post(`/asset/${assetId}/data`)
          .send({ contentType: "image/png" });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.url).toBeDefined();
      // the presigned url targets a fresh single-use staging key -- never
      // the asset's final key (the bytes are promoted server-side at commit)
      expect(resp.body.location).toMatch(
        /^uploads\/[a-f0-9]{24}\/[a-f0-9-]{36}\.png$/,
      );

      // step 2: upload directly to object storage
      let uploaded;
      try {
        uploaded = await fetch(resp.body.url, {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: new Uint8Array(await readFile("test/assets/1x1.png")),
        });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(uploaded.status).toBe(200);

      // step 3: commit the upload
      try {
        resp = await request(app)
          .put(`/asset/${assetId}/data`)
          .send({ contentType: "image/png" });
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.location).toMatch(
        /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
      );
      expect(resp.body.revision).toBe(1);
      // the commit response carries a fresh presigned download url
      expect(resp.body.url).toMatch(/X-Amz-Signature/);
      const user = await usersCollection.findOne({ sub: userZero });
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      const assets = await assetsCollection.find({ user: user!._id }).toArray();
      expect(assets).toBeDefined();
      expect(assets).not.toBeNull();
      expect(assets).toHaveLength(1);
    });
  });
  describe("data immutability", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(cleanupTestData);

    async function createUploadedAsset(name: string) {
      const created = await request(app).put("/asset").send({ name });
      expect(created.statusCode).toBe(201);
      const upload = await uploadAssetData(app, created.body._id);
      expect(upload.statusCode).toBe(200);
      expect(upload.body.revision).toBe(1);
      return created.body._id as string;
    }

    async function expectReplacementRefused(assetId: string) {
      const presigned = await request(app)
        .post(`/asset/${assetId}/data`)
        .send({ contentType: "image/png" });
      expect(presigned.statusCode).toBe(409);

      const commit = await request(app)
        .put(`/asset/${assetId}/data`)
        .send({ contentType: "image/png" });
      expect(commit.statusCode).toBe(409);
    }

    it("Should 409 when re-uploading the data of an unused asset", async () => {
      const assetId = await createUploadedAsset("IMMUTABLE_ASSET");
      await expectReplacementRefused(assetId);
    });

    it.each(["player", "detail", "overlay"])(
      "Should 409 when re-uploading the data of an asset used as a %s layer",
      async (layer) => {
        const sceneResponse = await request(app).get("/scene");
        expect(sceneResponse.statusCode).toBe(200);

        const assetId = await createUploadedAsset("LAYER_ASSET");

        const layerResp = await request(app)
          .put(`/scene/${sceneResponse.body[0]._id}/${layer}`)
          .send({ assetId });
        expect(layerResp.statusCode).toBe(200);

        await expectReplacementRefused(assetId);
      },
    );

    it("Should 409 when re-uploading the data of an asset used by a token", async () => {
      const assetId = await createUploadedAsset("TOKEN_ASSET");

      const token = await request(app)
        .put("/token")
        .send({ name: "immutable token", asset: assetId });
      expect(token.statusCode).toBe(201);

      await expectReplacementRefused(assetId);
    });
  });
  describe("staged uploads", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(cleanupTestData);

    async function createAsset(name: string) {
      const created = await request(app).put("/asset").send({ name });
      expect(created.statusCode).toBe(201);
      return created.body._id as string;
    }

    async function presign(assetId: string, contentType = "image/png") {
      const presigned = await request(app)
        .post(`/asset/${assetId}/data`)
        .send({ contentType });
      expect(presigned.statusCode).toBe(200);
      return presigned.body as { url: string; location: string };
    }

    async function putToUrl(
      url: string,
      bytes: Buffer,
      contentType = "image/png",
    ) {
      const uploaded = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: new Uint8Array(bytes),
      });
      expect(uploaded.status).toBe(200);
    }

    it("Should 400 when committing without a presign", async () => {
      const assetId = await createAsset("UNPRESIGNED_ASSET");

      const commit = await request(app)
        .put(`/asset/${assetId}/data`)
        .send({ contentType: "image/png" });
      expect(commit.statusCode).toBe(400);
    });

    it("Should 400 when the committed content type does not match the presign", async () => {
      const assetId = await createAsset("MISMATCHED_ASSET");

      const presigned = await presign(assetId, "image/png");
      await putToUrl(presigned.url, await readFile("test/assets/1x1.png"));

      const commit = await request(app)
        .put(`/asset/${assetId}/data`)
        .send({ contentType: "image/webp" });
      expect(commit.statusCode).toBe(400);
    });

    it("Should supersede the staging key on a new presign", async () => {
      const assetId = await createAsset("SUPERSEDED_ASSET");

      // first presign, with bytes uploaded to it
      const first = await presign(assetId);
      await putToUrl(first.url, await readFile("test/assets/1x1.png"));

      // a second presign supersedes the first staging key
      const second = await presign(assetId);
      expect(second.location).not.toBe(first.location);

      // the superseded staged object is eagerly deleted
      expect(await objectExists(first.location)).toBe(false);

      // committing only ever sees the latest staging key, so the bytes
      // uploaded to the superseded key are unreachable
      const commit = await request(app)
        .put(`/asset/${assetId}/data`)
        .send({ contentType: "image/png" });
      expect(commit.statusCode).toBe(400);
    });

    it("Should not let a replayed upload url touch committed asset data", async () => {
      const assetId = await createAsset("REPLAYED_ASSET");

      const original = await readFile("test/assets/1x1.png");
      const presigned = await presign(assetId);
      await putToUrl(presigned.url, original);

      const commit = await request(app)
        .put(`/asset/${assetId}/data`)
        .send({ contentType: "image/png" });
      expect(commit.statusCode).toBe(200);
      expect(commit.body.location).toMatch(
        /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
      );

      const location = commit.body.location as string;
      const key = location.replace(/^public\//, "");

      // a stale tab replays its url after the commit -- the write lands
      // on the old (deleted) staging key, not the final key
      await putToUrl(presigned.url, Buffer.from("tampered asset data"));

      // the staged garbage is harmless: the committed asset data and the
      // recorded revision are untouched
      expect(await objectExists(presigned.location)).toBe(true);
      expect(await getObjectBytes(key)).toEqual(original);

      const fetched = await request(app).get(`/asset/${assetId}`);
      expect(fetched.statusCode).toBe(200);
      expect(fetched.body.location).toBe(location);
      expect(fetched.body.revision).toBe(1);
    });

    it("Should remove the staged object when deleting an incomplete asset", async () => {
      const assetId = await createAsset("INCOMPLETE_ASSET");

      const presigned = await presign(assetId);
      await putToUrl(presigned.url, await readFile("test/assets/1x1.png"));
      expect(await objectExists(presigned.location)).toBe(true);

      const deleted = await request(app).delete(`/asset/${assetId}`);
      expect(deleted.statusCode).toBe(204);

      expect(await objectExists(presigned.location)).toBe(false);
    });

    it("Should never expose staging fields on the wire", async () => {
      const assetId = await createAsset("WIRE_ASSET");

      // a pending presign puts the staging fields on the database document
      const presigned = await presign(assetId);
      const stored = await assetsCollection.findOne({
        _id: new ObjectId(assetId),
      });
      expect(stored?.staging).toMatch(/^uploads\//);
      expect(stored?.stagedAt).toBeDefined();

      // the single asset fetch is wire projected
      const fetched = await request(app).get(`/asset/${assetId}`);
      expect(fetched.statusCode).toBe(200);
      expect(fetched.body.staging).not.toBeDefined();
      expect(fetched.body.stagedAt).not.toBeDefined();

      // so is the rename response (while a presign is pending)
      const renamed = await request(app)
        .put("/asset")
        .send({ _id: assetId, name: "WIRE_ASSET_RENAMED" });
      expect(renamed.statusCode).toBe(200);
      expect(renamed.body.name).toBe("WIRE_ASSET_RENAMED");
      expect(renamed.body.staging).not.toBeDefined();
      expect(renamed.body.stagedAt).not.toBeDefined();

      // and the commit response
      await putToUrl(presigned.url, await readFile("test/assets/1x1.png"));
      const commit = await request(app)
        .put(`/asset/${assetId}/data`)
        .send({ contentType: "image/png" });
      expect(commit.statusCode).toBe(200);
      expect(commit.body.staging).not.toBeDefined();
      expect(commit.body.stagedAt).not.toBeDefined();
      expect(commit.body.location).toBeDefined();

      // and the single asset fetch after the commit
      const after = await request(app).get(`/asset/${assetId}`);
      expect(after.statusCode).toBe(200);
      expect(after.body.staging).not.toBeDefined();
      expect(after.body.stagedAt).not.toBeDefined();
    });
  });
  describe("download urls", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(cleanupTestData);

    async function createUploadedAsset(name: string) {
      const created = await request(app).put("/asset").send({ name });
      expect(created.statusCode).toBe(201);
      const upload = await uploadAssetData(app, created.body._id);
      expect(upload.statusCode).toBe(200);
      return upload.body;
    }

    it("Should return a presigned url for each requested location", async () => {
      const uploaded = await createUploadedAsset("DOWNLOAD_URLS_ASSET");

      const resp = await request(app)
        .post("/asset/urls")
        .send({ locations: [uploaded.location] });
      expect(resp.statusCode).toBe(200);
      expect(resp.body.urls[uploaded.location]).toMatch(/X-Amz-Signature/);
    });

    it("Should fetch stored bytes through a presigned url without an Authorization header", async () => {
      const uploaded = await createUploadedAsset("BROWSER_DOWNLOAD_ASSET");
      const url = await createDownloadUrl(app, uploaded.location);

      // exactly how a browser loads an <img>: GET, no Authorization header
      // and no extra query parameters (both would break the signature)
      const fetched = await fetch(url);
      expect(fetched.status).toBe(200);
      expect(fetched.headers.get("content-type")).toBe("image/png");
      const expected = await readFile("test/assets/1x1.png");
      expect(Buffer.from(await fetched.arrayBuffer())).toEqual(expected);
    });

    it("Should serve the committed Cache-Control headers for immutable assets", async () => {
      const uploaded = await createUploadedAsset("CACHE_CONTROL_ASSET");

      const fetched = await fetchDownload(app, uploaded.location);
      expect(fetched.status).toBe(200);
      expect(fetched.headers.get("cache-control")).toBe(
        "private, max-age=2592000, immutable",
      );
    });

    it("Should attach urls to listed assets and single fetches", async () => {
      const uploaded = await createUploadedAsset("LISTED_WITH_DATA");
      const empty = await request(app)
        .put("/asset")
        .send({ name: "LISTED_WITHOUT_DATA" });
      expect(empty.statusCode).toBe(201);

      const list = await request(app).get("/asset");
      expect(list.statusCode).toBe(200);
      const withData = list.body.find(
        (asset: { name: string }) => asset.name === "LISTED_WITH_DATA",
      );
      const withoutData = list.body.find(
        (asset: { name: string }) => asset.name === "LISTED_WITHOUT_DATA",
      );
      expect(withData.url).toMatch(/X-Amz-Signature/);
      expect(withoutData.url).not.toBeDefined();

      const fetched = await request(app).get(`/asset/${uploaded._id}`);
      expect(fetched.statusCode).toBe(200);
      expect(fetched.body.url).toMatch(/X-Amz-Signature/);
    });

    it("Should 400 for an empty list of locations", async () => {
      const resp = await request(app)
        .post("/asset/urls")
        .send({ locations: [] });
      expect(resp.statusCode).toBe(400);
    });

    it("Should 400 for a non-string location", async () => {
      const resp = await request(app)
        .post("/asset/urls")
        .send({ locations: [12] });
      expect(resp.statusCode).toBe(400);
    });

    it("Should 400 for a malformed location", async () => {
      const resp = await request(app)
        .post("/asset/urls")
        .send({ locations: ["public/../secrets.png"] });
      expect(resp.statusCode).toBe(400);
    });

    it("Should 403 for another user's location", async () => {
      const uploaded = await createUploadedAsset("PRIVATE_ASSET");

      // the other user got their own account -- but not this location
      (getFakeUser as jest.Mock).mockReturnValue(userOne);
      const resp = await request(app)
        .post("/asset/urls")
        .send({ locations: [uploaded.location] });
      expect(resp.statusCode).toBe(403);
    });
  });
  describe("list", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(cleanupTestData);
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
        resp = await uploadAssetData(app, resp.body._id);
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
    it("Should 404 when renaming an asset that does not exist", async () => {
      let resp;
      try {
        resp = await request(app)
          .put("/asset")
          .send({ _id: "a".repeat(24), name: "missing" });
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(404);
    });
    afterEach(cleanupTestData);
  });
  describe("delete", () => {
    beforeEach(async () => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(cleanupTestData);
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
        resp = await uploadAssetData(app, resp.body._id);
      } catch (err) {
        fail(`Asset Upload Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.location).toMatch(
        /public\/[a-f0-9]{24}\/assets\/[a-f0-9]{24}\.png/,
      );

      const location = resp.body.location;
      const uploadedObject = await fetchDownload(app, location);
      expect(uploadedObject.status).toBe(200);

      try {
        resp = await request(app).delete(`/asset/${resp.body._id}`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(204);

      const deletedObject = await fetchDownload(app, location);
      expect(deletedObject.status).toBe(404);
    });
    describe("linked tokens", () => {
      it("Should refuse to delete an asset used by a token", async () => {
        const sceneResponse = await request(app).get("/scene");
        expect(sceneResponse.statusCode).toBe(200);

        const assetOne = await request(app)
          .put("/asset")
          .send({ name: "FIRST_ASSET" });
        expect(assetOne.statusCode).toBe(201);

        const upload = await uploadAssetData(app, assetOne.body._id);
        expect(upload.statusCode).toBe(200);
        const location = upload.body.location;

        // create token linked to the asset
        const first = await request(app)
          .put("/token")
          .send({ name: "first", asset: assetOne.body._id });
        expect(first.statusCode).toBe(201);

        const firstInstance: Omit<ScenelessTokenInstance, "angle"> = {
          name: "first instance",
          token: first.body._id,
          x: 0,
          y: 0,
          scale: 1,
          visible: true,
        };

        // create scene token instance
        const firstResp = await request(app)
          .put(`/scene/${sceneResponse.body[0]._id}/token`)
          .send(firstInstance);
        expect(firstResp.statusCode).toBe(201);

        // delete the linked asset -- should be refused
        expect(
          (await request(app).delete(`/asset/${assetOne.body._id}`)).statusCode,
        ).toBe(409);

        // the token should still exist
        const tokens = await request(app).get(`/token`);
        expect(tokens.statusCode).toBe(200);
        expect(tokens.body.length).toBe(1);

        // the token instance should still exist
        const url = `/scene/${sceneResponse.body[0]._id}/token`;
        const resp = await request(app).get(url);
        expect(resp.statusCode).toBe(200);
        expect(resp.body.length).toBe(1);
        expect(resp.body[0].token).toBe(first.body._id);

        // the asset document should still exist
        const asset = await request(app).get(`/asset/${assetOne.body._id}`);
        expect(asset.statusCode).toBe(200);

        // the asset file should still exist
        const storedObject = await fetchDownload(app, location);
        expect(storedObject.status).toBe(200);

        // removing the reference allows deletion
        expect(
          (await request(app).delete(`/token/${first.body._id}`)).statusCode,
        ).toBe(204);
        expect(
          (await request(app).delete(`/asset/${assetOne.body._id}`)).statusCode,
        ).toBe(204);

        const deletedObject = await fetchDownload(app, location);
        expect(deletedObject.status).toBe(404);
      });
    });
    describe("scene layers", () => {
      it("Should refuse to delete an asset used in a scene layer", async () => {
        const sceneResponse = await request(app).get("/scene");
        expect(sceneResponse.statusCode).toBe(200);

        const asset = await request(app)
          .put("/asset")
          .send({ name: "SCENE_ASSET" });
        expect(asset.statusCode).toBe(201);

        const upload = await uploadAssetData(app, asset.body._id);
        expect(upload.statusCode).toBe(200);
        const location = upload.body.location;

        const layerResp = await request(app)
          .put(`/scene/${sceneResponse.body[0]._id}/player`)
          .send({ assetId: asset.body._id });
        expect(layerResp.statusCode).toBe(200);

        // delete the referenced asset -- should be refused
        expect(
          (await request(app).delete(`/asset/${asset.body._id}`)).statusCode,
        ).toBe(409);

        // the asset document should still exist
        const fetched = await request(app).get(`/asset/${asset.body._id}`);
        expect(fetched.statusCode).toBe(200);

        // the asset file should still exist
        const storedObject = await fetchDownload(app, location);
        expect(storedObject.status).toBe(200);
      });
    });
  });
  describe("usage", () => {
    beforeEach(() => {
      (getFakeUser as jest.Mock).mockReturnValue(userZero);
    });
    afterEach(cleanupTestData);
    it("Should 404 when getting the usage of a missing asset", async () => {
      const url = `/asset/${"a".repeat(24)}/usage`;
      let resp;
      try {
        resp = await request(app).get(url);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(404);
    });
    it("Should report no usage for an unused asset", async () => {
      const asset = await request(app)
        .put("/asset")
        .send({ name: "UNUSED_ASSET" });
      expect(asset.statusCode).toBe(201);

      let resp;
      try {
        resp = await request(app).get(`/asset/${asset.body._id}/usage`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.tokens).toHaveLength(0);
      expect(resp.body.scenes).toHaveLength(0);
    });
    it("Should list the tokens and scenes using the asset", async () => {
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

      const asset = await request(app)
        .put("/asset")
        .send({ name: "USED_ASSET" });
      expect(asset.statusCode).toBe(201);

      const token = await request(app)
        .put("/token")
        .send({ name: "usage token", asset: asset.body._id });
      expect(token.statusCode).toBe(201);

      const instance: Omit<ScenelessTokenInstance, "angle"> = {
        name: "usage instance",
        token: token.body._id,
        x: 0,
        y: 0,
        scale: 1,
        visible: true,
      };
      const instanceResp = await request(app)
        .put(`/scene/${sceneResponse.body[0]._id}/token`)
        .send(instance);
      expect(instanceResp.statusCode).toBe(201);

      let resp;
      try {
        resp = await request(app).get(`/asset/${asset.body._id}/usage`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.tokens).toHaveLength(1);
      expect(resp.body.tokens[0]._id).toBe(token.body._id);
      expect(resp.body.tokens[0].name).toBe("usage token");
      expect(resp.body.scenes).toHaveLength(1);
      expect(resp.body.scenes[0]._id).toBe(sceneResponse.body[0]._id);

      // clean up the token (and its instances) so later tests start clean
      expect(
        (await request(app).delete(`/token/${token.body._id}`)).statusCode,
      ).toBe(204);
    });
    it("Should list scenes using the asset as a layer", async () => {
      const sceneResponse = await request(app).get("/scene");
      expect(sceneResponse.statusCode).toBe(200);

      const asset = await request(app)
        .put("/asset")
        .send({ name: "LAYER_ASSET" });
      expect(asset.statusCode).toBe(201);

      const layerResp = await request(app)
        .put(`/scene/${sceneResponse.body[0]._id}/overlay`)
        .send({ assetId: asset.body._id });
      expect(layerResp.statusCode).toBe(200);

      let resp;
      try {
        resp = await request(app).get(`/asset/${asset.body._id}/usage`);
      } catch (err) {
        fail(`Exception: ${JSON.stringify(err)}`);
      }
      expect(resp.statusCode).toBe(200);
      expect(resp.body.tokens).toHaveLength(0);
      expect(resp.body.scenes).toHaveLength(1);
      expect(resp.body.scenes[0]._id).toBe(sceneResponse.body[0]._id);
    });
  });
});
