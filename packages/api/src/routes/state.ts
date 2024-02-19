/**TODO THIS SHOULD BE TABLETOP */
import { Request, Response, NextFunction } from "express";
import { ASSETS_UPDATED_SIG, OBJECT_ID_LEN } from "../utils/constants";
import { getUser, userExistsOr401 } from "../utils/user";
import {
  getOrCreateTableTop,
  getTableTopByUser,
  setTableTopByScene,
} from "../utils/tabletop";
import { getSceneById } from "../utils/scene";

export function updateState(req: Request, res: Response, next: NextFunction) {
  const sceneID: string = req.body.scene;
  if (!sceneID) throw new Error("Missing scene id", { cause: 400 });
  if (sceneID.length !== OBJECT_ID_LEN)
    throw new Error("Invalid scene id", { cause: 400 });

  return getUser(req.auth)
    .then((user) => userExistsOr401(user))
    .then((user) => getOrCreateTableTop(user)) // maybe we can skip this and just update by ID
    .then((table) => setTableTopByScene(table._id.toString(), sceneID))
    .then((table) => getSceneById(sceneID, table.user.toString()))
    .then((scene) => res.app.emit(ASSETS_UPDATED_SIG, scene))
    .then(() => res.sendStatus(200))
    .catch((err) => next(err));
}

export function getState(req: Request, res: Response, next: NextFunction) {
  return getUser(req.auth)
    .then((user) => userExistsOr401(user))
    .then((user) => getTableTopByUser(user))
    .then((table) => res.json(table))
    .catch((err) => next(err));
}
