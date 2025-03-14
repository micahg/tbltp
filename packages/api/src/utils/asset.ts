import { Asset, AssetModel, IAsset } from "../models/asset";
import { IUser } from "../models/user";
import { NAME_REGEX } from "../routes/scene";
import { checkSchema } from "express-validator";
import { knownMongoError } from "./errors";

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

export async function setAssetLocation(asset: IAsset, location: string) {
  return AssetModel.updateOne(
    { _id: { $eq: asset._id } },
    { location: location },
  );
}
