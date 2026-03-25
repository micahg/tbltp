import { NextFunction, Request, Response } from "express";
import { getUser, getOrCreateUser, userExistsOr401 } from "../utils/user";
import {
  getUserScene,
  createUserScene,
  getOrCreateScenes,
  getSceneById,
  SceneLayer,
  setSceneLayerAsset,
  setSceneViewport,
} from "../utils/scene";
import { OBJECT_ID_LEN } from "../utils/constants";
import { IScene } from "../models/scene";
import { validateAngle, validateViewPort } from "../utils/viewport";
import { Rect } from "@micahg/tbltp-common";
import { deleteUserSceneTokenInstances } from "../utils/tokeninstance";
import { deleteUserSceneAssetInstances, getUserAsset } from "../utils/asset";

export const NAME_REGEX = /^[\w\s]{1,64}$/;

function sceneExistsOr404(scene: IScene) {
  if (!scene) throw new Error("No scene", { cause: 404 });
  return scene;
}

// TODO move this to validators
function validateScene(scene: IScene): IScene {
  if (!scene) throw new Error("No scene", { cause: 400 });
  if (!NAME_REGEX.test(scene.description))
    throw new Error("Invalid scene description", { cause: 400 });
  return scene;
}

export function getScene(req: Request, res: Response, next: NextFunction) {
  return (
    getUser(req.auth)
      // do 401 a non-existant user as they don't have access to any scenes
      .then((user) => userExistsOr401(user))
      .then((user) => getSceneById(req.params.id, user._id.toString()))
      .then((scene) => {
        if (scene) return res.status(200).send(scene);
        return res.sendStatus(404);
      })
      .catch((err) => next(err))
  );
}

export function getScenes(req: Request, res: Response, next: NextFunction) {
  // don't 401 on a non-existant user -- create them (their token has validated)
  return getOrCreateUser(req.auth)
    .then((user) => getOrCreateScenes(user))
    .then((scenes) => res.status(200).json(scenes))
    .catch(() => next({ status: 500 }));
}

export async function deleteScene(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getUser(req.auth);
    userExistsOr401(user);
    const scene = await getUserScene(user, req.params.id);
    await Promise.all([
      deleteUserSceneTokenInstances(user, scene),
      deleteUserSceneAssetInstances(user, scene),
      scene.deleteOne(),
    ]);
    res.sendStatus(204);
  } catch (err) {
    return next(err);
  }
}

export function createScene(req: Request, res: Response, next: NextFunction) {
  return getUser(req.auth)
    .then((user) => userExistsOr401(user))
    .then((user) => {
      validateScene(req.body);
      return createUserScene(user, req.body);
    })
    .then((scene) => res.send(scene))
    .catch((err) => next(err));
}

export async function updateSceneContent(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.params.id.length != OBJECT_ID_LEN) return res.sendStatus(400);

  try {
    const user = await getUser(req.auth);
    userExistsOr401(user); // valid token but no user => 401

    const scene = sceneExistsOr404(
      await getSceneById(req.params.id, user._id.toString()),
    ); // valid user but no scene => 404

    const layer = req.params.layer as SceneLayer;
    const asset = await getUserAsset(user, req.body.assetId);
    if (!asset) {
      throw new Error("No asset", { cause: 404 });
    }

    return res.json(
      await setSceneLayerAsset(
        scene._id.toString(),
        layer,
        asset._id.toString(),
      ),
    );
  } catch (err) {
    return next(err);
  }
}

export function updateSceneViewport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.params.id.length != OBJECT_ID_LEN) return res.sendStatus(400);

  const vp: Rect = req.body.viewport;
  const bg: Rect = req.body.backgroundSize;
  const angle: number = req.body.angle;

  if ((angle === undefined || angle === null) && !bg && !vp)
    throw new Error(`Nothing to do`, { cause: 400 });

  if (vp && !validateViewPort(vp))
    throw new Error(`Invalid height in set viewport body`, { cause: 400 });

  if (bg && !validateViewPort(bg))
    throw new Error(`Invalid background rect in set viewport body`, {
      cause: 400,
    });

  if (angle && !validateAngle(angle))
    throw new Error(`Invalid angle in set viewport body`, { cause: 400 });

  return getUser(req.auth)
    .then((user) => userExistsOr401(user))
    .then((user) => getSceneById(req.params.id, user._id.toString()))
    .then((scene) => setSceneViewport(scene._id.toString(), bg, vp, angle))
    .then((scene) => res.json(scene))
    .catch((err) => next(err));
}
