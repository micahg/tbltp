/**TODO THIS SHOULD BE TABLETOP */
import { Request, Response, NextFunction } from "express";
import { ASSETS_UPDATED_SIG } from "../utils/constants";
import { getUser, userExistsOr401 } from "../utils/user";
import {
  getOrCreateTableTop,
  getTableTopByUser,
  setTableTopByScene,
} from "../utils/tabletop";
import { getUserScene } from "../utils/scene";
import {
  getSceneTokenInstanceAssets,
  getSceneTokenInstances,
} from "../utils/tokeninstance";
import { HydratedTokenInstance } from "@micahg/tbltp-common";
import { IUser } from "../models/user";
import { ITokenInstance } from "../models/tokeninstance";
import { IScene } from "../models/scene";
import { Document } from "mongoose";

export async function hydrateStateToken(
  user: IUser,
  scene: IScene,
  tokens: Document<unknown, object, ITokenInstance>[],
) {
  const stuff = await getSceneTokenInstanceAssets(user, scene);
  if (stuff.length !== tokens.length)
    throw new Error("Token count mismatch", { cause: 400 });

  // this only works because we're starting from the same query on user/scene/visible
  const hydrated: HydratedTokenInstance[] = [];
  for (const [i, token] of tokens.entries()) {
    const t = token.toObject({
      flattenObjectIds: true,
    }) as unknown as HydratedTokenInstance;
    t.asset = stuff[i].assets.location;
    hydrated.push(t);
  }
  return hydrated;
}

export async function updateState(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const sceneID: string = req.body.scene;

  try {
    const user = await getUser(req.auth);
    await userExistsOr401(user);
    const table = await getOrCreateTableTop(user);
    await setTableTopByScene(table._id.toString(), sceneID);
    const scenePromise = getUserScene(user, sceneID);
    // get *visible* tokens
    const tokenPromise = getSceneTokenInstances(user, sceneID, true);
    const [scene, tokens] = await Promise.all([scenePromise, tokenPromise]);
    res.sendStatus(200);

    // fucking normalized tokens - get unique token ids - if this ever scales this probably
    // needs to come off the hot path -- how big could a

    // this only works because we're starting from the same query on user/scene/visible
    const hydrated = await hydrateStateToken(user, scene, tokens);

    res.app.emit(ASSETS_UPDATED_SIG, scene, hydrated);
  } catch (err) {
    return next(err);
  }
}

export function getState(req: Request, res: Response, next: NextFunction) {
  return getUser(req.auth)
    .then((user) => userExistsOr401(user))
    .then((user) => getTableTopByUser(user))
    .then((table) => res.json(table))
    .catch((err) => next(err));
}
