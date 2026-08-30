import { Asset, AssetModel, IAsset } from "../models/asset";
import { IScene } from "../models/scene";
import { IToken } from "../models/token";
import { IUser } from "../models/user";
import { NAME_REGEX } from "../routes/scene";
import { checkSchema } from "express-validator";
import { knownMongoError } from "./errors";
import { sceneUsesAsset, scenesUsingAsset } from "./scene";
import { tokenUsesAsset, tokensUsingAsset } from "./token";

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

export function listUserAssets(user: IUser) {
  return AssetModel.find({ user: { $eq: user._id } }).select(
    "name location revision",
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

export function getUserAsset(user: IUser, id: string) {
  return AssetModel.findOne({ _id: { $eq: id }, user: { $eq: user._id } });
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

export async function setAssetLocation(asset: IAsset, location: string) {
  return AssetModel.updateOne(
    { _id: { $eq: asset._id } },
    { location: location },
  );
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
