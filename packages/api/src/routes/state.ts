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
import { getSceneTokenInstances } from "../utils/tokeninstance";

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
    const tokenPromise = getSceneTokenInstances(user, sceneID);
    const [scene, tokens] = await Promise.all([scenePromise, tokenPromise]);
    res.app.emit(ASSETS_UPDATED_SIG, scene, tokens);
    res.sendStatus(200);
  } catch (err) {
    return next(err);
  }
  // return getUser(req.auth)
  //   .then((user) => userExistsOr401(user))
  //   .then((user) => getOrCreateTableTop(user)) // maybe we can skip this and just update by ID
  //   .then((table) => setTableTopByScene(table._id.toString(), sceneID))
  //   .then((table) => getSceneById(sceneID, table.user.toString()))
  //   .then((scene) => res.app.emit(ASSETS_UPDATED_SIG, scene))
  //   .then(() => res.sendStatus(200))
  //   .catch((err) => next(err));
}

export function getState(req: Request, res: Response, next: NextFunction) {
  return getUser(req.auth)
    .then((user) => userExistsOr401(user))
    .then((user) => getTableTopByUser(user))
    .then((table) => res.json(table))
    .catch((err) => next(err));
}
