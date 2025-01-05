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
      isInt: {
        errorMessage: "scale must be an integer",
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

export function getSceneTokenInstances(user: IUser, scene: string) {
  return TokenInstanceModel.find({
    user: { $eq: user._id },
    scene: { $eq: scene },
  });
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
