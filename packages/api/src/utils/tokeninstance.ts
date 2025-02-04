import { checkSchema } from "express-validator";
import { NAME_REGEX } from "../routes/scene";
import { MAX_HP, MIN_HP } from "@micahg/tbltp-common";
import {
  TokenInstance,
  ITokenInstance,
  TokenInstanceModel,
} from "../models/tokeninstance";
import { knownMongoError } from "./errors";
import { IUser } from "../models/user";
import mongoose from "mongoose";
import { IScene } from "../models/scene";

export function tokenInstanceValidator() {
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
        errorMessage: "Invalid token instance name",
      },
    },
    _id: {
      in: ["body"],
      optional: true,
      isMongoId: {
        errorMessage: "Invalid token instance ID",
      },
    },
    token: {
      in: ["body"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid token ID",
      },
    },
    id: {
      in: ["params"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid scene ID",
      },
    },
    visible: {
      in: ["body"],
      optional: false,
      default: false,
      isBoolean: {
        errorMessage: "Visible must be a boolean",
      },
    },
    hitPoints: {
      in: ["body"],
      optional: true,
      isInt: {
        options: {
          max: MAX_HP,
          min: MIN_HP,
        },
        errorMessage: "Hit points must be an integer",
      },
    },
    x: {
      in: ["body"],
      optional: false,
      isInt: {
        errorMessage: "X must be an integer",
      },
    },
    y: {
      in: ["body"],
      optional: false,
      isInt: {
        errorMessage: "Y must be an integer",
      },
    },
    scale: {
      in: ["body"],
      optional: false,
      isNumeric: {
        errorMessage: "scale must be a number",
      },
    },
    angle: {
      in: ["body"],
      optional: true,
      isInt: {
        options: {
          min: 0,
          max: 359,
        },
        errorMessage:
          "angle must be an integer arg degree between 0 and 359 inclusive",
      },
    },
  });
}

export function sceneTokenInstanceValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid scene ID",
      },
    },
  });
}

export function deleteTokenInstanceValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid token instance ID",
      },
    },
  });
}

export function getSceneTokenInstances(
  user: IUser,
  scene: string,
  visible?: boolean,
) {
  const query = {
    user: { $eq: user._id },
    scene: { $eq: scene },
  };
  if (visible !== undefined) {
    query["visible"] = { $eq: visible };
  }
  return TokenInstanceModel.find(query);
}

export function getSceneTokenInstanceAssets(user: IUser, scene: IScene) {
  return TokenInstanceModel.aggregate([
    { $match: { scene: scene._id, visible: true } },
    { $project: { token: 1 } },
    {
      $lookup: {
        from: "tokens",
        localField: "token",
        foreignField: "_id",
        as: "tokens",
      },
    },
    { $project: { _id: 1, "tokens.asset": 1 } },
    { $unwind: "$tokens" },
    {
      $lookup: {
        from: "assets",
        localField: "tokens.asset",
        foreignField: "_id",
        as: "assets",
      },
    },
    { $project: { _id: 1, "assets.location": 1 } },
    { $unwind: "$assets" },
  ]);
}

export function getUserTokenInstance(user: IUser, id: string) {
  return TokenInstanceModel.findOne({
    _id: { $eq: id },
    user: { $eq: user._id },
  });
  // TODO try to cast to ITokenInstance to remove mongo timestamps
}

export function deleteUserTokenInstance(user: IUser, id: string) {
  return TokenInstanceModel.deleteOne({
    _id: { $eq: id },
    user: { $eq: user._id },
  });
}

export async function createUserTokenInstance(
  user: IUser,
  tokenInstance: ITokenInstance,
) {
  try {
    if (tokenInstance._id) {
      throw new Error("Cannot create a token instance with an ID", {
        cause: 400,
      });
    }
    tokenInstance.user = user._id;
    const result = await TokenInstanceModel.create(tokenInstance);
    return result;
  } catch (err) {
    knownMongoError(err);
  }
}

export async function updateTokenInstance(
  instance: ITokenInstance & mongoose.Document,
  update: TokenInstance,
) {
  if (instance.name !== update.name) {
    instance.name = update.name;
  }
  if (instance.scene !== update.scene) {
    instance.scene = update.scene;
  }
  if (instance.token !== update.token) {
    instance.token = update.token;
  }
  if (instance.visible !== update.visible) {
    instance.visible = update.visible;
  }
  if (instance.hitPoints !== update.hitPoints) {
    instance.hitPoints = update.hitPoints;
  }
  if (instance.x !== update.x) {
    instance.x = update.x;
  }
  if (instance.y !== update.y) {
    instance.y = update.y;
  }
  if (instance.scale !== update.scale) {
    instance.scale = update.scale;
  }
  return instance.save();
}
