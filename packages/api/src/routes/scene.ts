import { NextFunction, Request, Response } from "express";
import { getUser, getOrCreateUser, userExistsOr401 } from "../utils/user";
import { log } from "../utils/logger";
import { errorStatus } from "../utils/errors";
import {
  getUserScene,
  createUserScene,
  getOrCreateScenes,
  getSceneById,
  SceneLayer,
  setSceneLayerAsset,
  setSceneViewport,
} from "../utils/scene";
import { NO_STORE_CACHE_CONTROL, OBJECT_ID_LEN } from "../utils/constants";
import { IScene } from "../models/scene";
import { IUser } from "../models/user";
import { validateAngle, validateViewPort } from "../utils/viewport";
import { Rect } from "@micahg/tbltp-common";
import { deleteUserSceneTokenInstances } from "../utils/tokeninstance";
import {
  createUserAsset,
  deleteUserSceneAssetInstances,
  getUserAsset,
  getUserAssetWithStaging,
} from "../utils/asset";
import { commitAssetData, presignAssetUpload } from "../utils/assetstore";

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

export async function getScenes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // don't 401 on a non-existant user -- create them (their token has validated)
    const user = await getOrCreateUser(req.auth);
    const scenes = await getOrCreateScenes(user);
    return res.status(200).json(scenes);
  } catch (err) {
    log.error("Unable to list user scenes", err);
    return next({ status: errorStatus(err) });
  }
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

/**
 * Resolve the scene's overlay asset, creating and assigning it on the first
 * update (absorbs the create + assign the editor used to do client-side).
 */
async function resolveSceneOverlayAsset(user: IUser, scene: IScene) {
  const asset = scene.overlayId
    ? await getUserAssetWithStaging(user, scene.overlayId.toString())
    : null;
  if (asset) return asset;

  const created = await createUserAsset(user, {
    name: `scene ${scene._id} overlay`,
    tags: ["scene"],
  });
  if (!created) {
    throw new Error("Unable to create the overlay asset", { cause: 500 });
  }
  await setSceneLayerAsset(
    scene._id.toString(),
    "overlay",
    created._id!.toString(),
  );
  return created;
}

/**
 * Issue a presigned url for uploading the scene's overlay data. The overlay
 * is regenerated as the game master annotates, so this (and its commit
 * sibling) are the only sanctioned asset data replacement endpoints.
 */
export async function createSceneOverlayUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getUser(req.auth);
    userExistsOr401(user);
    const scene = sceneExistsOr404(
      await getSceneById(req.params.id, user._id.toString()),
    );

    const asset = await resolveSceneOverlayAsset(user, scene);
    return res.json(
      await presignAssetUpload(user, asset, req.body.contentType),
    );
  } catch (err) {
    log.error("Unable to create scene overlay upload url", err);
    return next({ status: errorStatus(err) });
  }
}

/**
 * Commit a scene overlay upload: verify the object landed in storage, then
 * record the location and bump the revision on the overlay asset.
 */
export async function commitSceneOverlayData(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await getUser(req.auth);
    userExistsOr401(user);
    const scene = sceneExistsOr404(
      await getSceneById(req.params.id, user._id.toString()),
    );

    if (!scene.overlayId) {
      throw new Error("No overlay asset", { cause: 404 });
    }
    // the commit reads the upload staging bookkeeping
    const asset = await getUserAssetWithStaging(
      user,
      scene.overlayId.toString(),
    );
    if (!asset) {
      throw new Error("No overlay asset", { cause: 404 });
    }

    // the overlay is replaced at the same key on every annotation, so its
    // stored Cache-Control must never allow a stale copy to be served
    return res.json(
      await commitAssetData(
        user,
        asset,
        req.body.contentType,
        NO_STORE_CACHE_CONTROL,
      ),
    );
  } catch (err) {
    log.error("Unable to commit scene overlay data", err);
    return next({ status: errorStatus(err) });
  }
}
