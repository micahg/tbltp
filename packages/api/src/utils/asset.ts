import { ASSET_FIELDS, ASSET_SUMMARY_FIELDS } from "@micahg/tbltp-common";
import { Asset, AssetModel, IAsset } from "../models/asset";
import { IScene } from "../models/scene";
import { IToken } from "../models/token";
import { IUser } from "../models/user";
import { MAX_DOWNLOAD_URL_LOCATIONS, VALID_CONTENT_TYPES } from "./constants";
import { NAME_REGEX } from "../routes/scene";
import { checkSchema } from "express-validator";
import { knownMongoError } from "./errors";
import { sceneUsesAsset, scenesUsingAsset } from "./scene";
import { tokenUsesAsset, tokensUsingAsset } from "./token";
import { createDownloadUrl } from "./s3store";

export function assetValidator() {
  return checkSchema({
    name: {
      in: ["body"],
      exists: {
        errorMessage: "Name is required",
      },
      isString: {
        errorMessage: "Name must be a string",
      },
      matches: {
        options: NAME_REGEX,
        errorMessage: "Invalid asset name",
      },
    },
    _id: {
      in: ["body"],
      optional: true,
      isMongoId: {
        errorMessage: "Invalid asset ID",
      },
    },
  });
}

export function assetDataValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid asset ID",
      },
    },
  });
}

/**
 * Validates the presign (POST) and commit (PUT) requests for asset data:
 * the asset id and the content type of the file being uploaded.
 */
export function assetDataUploadValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid asset ID",
      },
    },
    contentType: {
      in: ["body"],
      exists: {
        errorMessage: "Content type is required",
      },
      isString: {
        errorMessage: "Content type must be a string",
      },
      isIn: {
        options: [VALID_CONTENT_TYPES],
        errorMessage: "Invalid content type",
      },
    },
  });
}

export function assetDeleteValiator() {
  return checkSchema({
    id: {
      in: ["params"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid asset ID",
      },
    },
  });
}

/**
 * Validates a batch download-url request: a bounded, non-empty array of
 * asset locations.
 */
export function assetUrlsValidator() {
  return checkSchema({
    locations: {
      in: ["body"],
      isArray: {
        options: { min: 1, max: MAX_DOWNLOAD_URL_LOCATIONS },
        errorMessage: "locations must be a non-empty array",
      },
    },
    "locations.*": {
      in: ["body"],
      isString: {
        errorMessage: "Each location must be a string",
      },
    },
  });
}

/**
 * Convert a fetched asset (mongoose document or plain object) to a plain
 * object. Documents are converted through toObject so no internal mongoose
 * state leaks into the response.
 */
function toPlainObject<T extends object>(asset: T): T {
  const candidate = asset as unknown as { toObject?: (options?: object) => T };
  if (typeof candidate.toObject === "function") {
    return candidate.toObject({ flattenObjectIds: true });
  }
  return { ...asset };
}

/**
 * Project an asset onto the wire, attaching a freshly signed download url
 * for its stored data (assets without data have no url). A new signature is
 * minted on every serialization -- the url is short-lived by design, so it
 * must never be persisted, logged, or compared for equality.
 */
export async function serializeAsset<T extends { location?: string }>(
  asset: T,
): Promise<T & { url?: string }> {
  const plain = toPlainObject(asset);
  if (!plain.location) {
    return { ...plain };
  }
  return { ...plain, url: await createDownloadUrl(plain.location) };
}

/**
 * Serialize a list of assets, minting a download url for every stored one.
 */
export function serializeAssets<T extends { location?: string }>(assets: T[]) {
  return Promise.all(assets.map((asset) => serializeAsset(asset)));
}

/**
 * List the user's assets with only the summary wire fields (see
 * ASSET_SUMMARY_FIELDS in the common package).
 */
export function listUserAssets(user: IUser) {
  return AssetModel.find({ user: { $eq: user._id } }).select(
    ASSET_SUMMARY_FIELDS,
  );
}

export async function createUserAsset(user: IUser, asset: Asset) {
  try {
    const dbAsset = asset as IAsset;
    dbAsset.user = user._id;
    return await AssetModel.create(dbAsset);
  } catch (err) {
    knownMongoError(err);
  }
}

/**
 * Fetch one of the user's assets with the wire projection (see
 * ASSET_FIELDS in the common package) -- database-only fields never
 * reach the wire, so this is the safe default. Callers that need the
 * upload staging bookkeeping must use getUserAssetWithStaging instead.
 */
export function getUserAsset(user: IUser, id: string) {
  return AssetModel.findOne({
    _id: { $eq: id },
    user: { $eq: user._id },
  }).select(ASSET_FIELDS);
}

/**
 * Fetch one of the user's assets including the database-only upload
 * staging fields. The upload machinery (presign supersession, commit,
 * staged-object cleanup) reads the staging bookkeeping.
 */
export function getUserAssetWithStaging(user: IUser, id: string) {
  return AssetModel.findOne({
    _id: { $eq: id },
    user: { $eq: user._id },
  });
}

/**
 * Rename an asset. The update is atomic and projected to the wire fields,
 * so it can neither clobber concurrent updates nor leak database-only
 * fields.
 */
export function renameUserAsset(user: IUser, id: string, name: string) {
  return AssetModel.findOneAndUpdate(
    { _id: { $eq: id }, user: { $eq: user._id } },
    { $set: { name: name } },
    { new: true },
  ).select(ASSET_FIELDS);
}

export async function assetInUse(user: IUser, asset: IAsset): Promise<boolean> {
  if (!asset._id) {
    throw new Error("Asset missing id");
  }

  const [inScene, inToken] = await Promise.all([
    sceneUsesAsset(user, asset._id),
    tokenUsesAsset(user, asset._id),
  ]);
  return inScene || inToken;
}

/**
 * Report where an asset is used: the tokens that reference it and the scenes
 * that use it either directly as a layer or through placed token instances.
 *
 * @param user The user whose data is checked.
 * @param asset The asset to look for.
 * @returns A promise resolving to the tokens and scenes that use the asset.
 */
export async function assetUsage(
  user: IUser,
  asset: IAsset,
): Promise<{ tokens: IToken[]; scenes: IScene[] }> {
  if (!asset._id) {
    throw new Error("Asset missing id");
  }

  const tokens = await tokensUsingAsset(user, asset._id);
  const scenes = await scenesUsingAsset(user, asset._id, tokens);
  return { tokens, scenes };
}

export function deleteUserSceneAssetInstances(user: IUser, scene: IScene) {
  const sceneAssetIds = [
    scene.playerId,
    scene.detailId,
    scene.overlayId,
  ].filter((assetId) => !!assetId);

  if (sceneAssetIds.length === 0) {
    return Promise.resolve({ acknowledged: true, deletedCount: 0 });
  }

  return AssetModel.deleteMany({
    user: { $eq: user._id },
    _id: { $in: sceneAssetIds },
  });
}
