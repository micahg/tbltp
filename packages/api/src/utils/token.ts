import { checkSchema } from "express-validator";
import { NAME_REGEX } from "../routes/scene";
import { MAX_HP, MIN_HP } from "@micahg/tbltp-common";
import { IUser } from "../models/user";
import { IToken, TokenModel } from "../models/token";
import { knownMongoError } from "./errors";

const TOKEN_MASK = "name visible asset hitPoints";

export function tokenValidator() {
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
        errorMessage: "Invalid token name",
      },
    },
    _id: {
      in: ["body"],
      optional: true,
      isMongoId: {
        errorMessage: "Invalid token ID",
      },
    },
    visible: {
      in: ["body"],
      optional: true,
      default: false,
      isBoolean: {
        errorMessage: "Visible must be a boolean",
      },
    },
    asset: {
      in: ["body"],
      optional: true,
      isMongoId: {
        errorMessage: "Invalid asset ID",
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
  });
}

export function tokenDeleteValidator() {
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

export function getUserToken(user: IUser, id: string) {
  return TokenModel.findOne({
    _id: { $eq: id },
    user: { $eq: user._id },
  }).select(TOKEN_MASK);
}

export function listUserTokens(user: IUser) {
  return TokenModel.find({ user: { $eq: user._id } }).select(TOKEN_MASK);
}

export async function createUserToken(user: IUser, token: IToken) {
  try {
    if (token._id) {
      throw new Error("Cannot create a token with an ID", { cause: 400 });
    }
    token.user = user._id;
    const result = await TokenModel.create(token);
    return result;
  } catch (err) {
    knownMongoError(err);
  }
}
