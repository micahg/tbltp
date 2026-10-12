import { readFile } from "node:fs/promises";

import * as request from "supertest";

/**
 * Run the full presigned upload flow against the app:
 *
 * 1. ask the API for a presigned upload URL,
 * 2. PUT the file bytes directly to object storage,
 * 3. commit the upload so the asset record is updated.
 *
 * The response of whichever step failed (or the final commit response on
 * success) is returned so callers can assert on status codes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function presignedUploadCommit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any,
  presignUrl: string,
  commitUrl: string,
  filePath = "test/assets/1x1.png",
  contentType = "image/png",
) {
  const presigned = await request(app).post(presignUrl).send({ contentType });
  if (presigned.statusCode !== 200) {
    return presigned;
  }

  const body = await readFile(filePath);
  const uploaded = await fetch(presigned.body.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(body),
  });
  if (!uploaded.ok) {
    throw new Error(`Presigned upload failed (${uploaded.status})`);
  }

  return request(app).put(commitUrl).send({ contentType });
}

/**
 * Run the full presigned upload flow for an asset against the app.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function uploadAssetData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any,
  assetId: string,
  filePath?: string,
  contentType?: string,
) {
  return presignedUploadCommit(
    app,
    `/asset/${assetId}/data`,
    `/asset/${assetId}/data`,
    filePath,
    contentType,
  );
}

/**
 * Run the full presigned upload flow for a scene overlay against the app.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function uploadSceneOverlayData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any,
  sceneId: string,
  filePath?: string,
  contentType?: string,
) {
  return presignedUploadCommit(
    app,
    `/scene/${sceneId}/overlay/data`,
    `/scene/${sceneId}/overlay/data`,
    filePath,
    contentType,
  );
}
