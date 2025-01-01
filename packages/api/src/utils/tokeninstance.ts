import { checkSchema } from "express-validator";
import { NAME_REGEX } from "../routes/scene";
import { MAX_HP, MIN_HP } from "@micahg/tbltp-common";
import { ITokenInstance, TokenInstanceModel } from "../models/tokeninstance";
import { knownMongoError } from "./errors";
import { IUser } from "../models/user";

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
    scene: {
      in: ["body"],
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
