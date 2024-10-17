import { Asset } from "@micahg/tbltp-common";
import { AssetModel, IAsset } from "../models/asset";
import { IUser } from "../models/user";
import { NAME_REGEX } from "../routes/scene";
// import { log } from "../utils/logger";
import { checkSchema } from "express-validator";

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

export function listUserAssets(user: IUser) {
  return AssetModel.find({ user: user._id }).select("name location");
}

export function createUserAsset(user: IUser, asset: Asset) {
  const dbAsset = asset as IAsset;
  dbAsset.user = user._id;
  return AssetModel.create(dbAsset);
}

export function getUserAsset(user: IUser, id: string) {
  return AssetModel.findOne({ _id: id, user: user._id });
}

export async function setAssetLocation(asset: IAsset, location: string) {
  return AssetModel.updateOne({ _id: asset._id }, { location: location });
}