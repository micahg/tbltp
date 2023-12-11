import { Request, Response } from "express";
import { getUser, getOrCreateUser, userExistsOr401 } from "../utils/user";
import { createUserScene, deleteUserScene, getOrCreateScenes, getSceneById, setSceneOverlayContent, setScenePlayerContent, setSceneDetailContent, setSceneViewport } from "../utils/scene";
import { OBJECT_ID_LEN, VALID_LAYERS } from "../utils/constants";
import { IScene } from "../models/scene";
import { LayerUpdate, updateAssetFromLink, updateAssetFromUpload } from "../utils/localstore";
import { validateAngle, validateViewPort } from "../utils/viewport";
import { Rect } from "../utils/tablestate";

const NAME_REGEX = /^[\w\s]{1,64}$/;

function sceneExistsOr404(scene: IScene) {
  if (!scene) throw new Error('No scene', {cause: 404});
  return scene;
}

// TODO move this to validators
function validateScene(scene: IScene): IScene {
  if (!scene) throw new Error('No scene', {cause: 400});
  if (!NAME_REGEX.test(scene.description)) throw new Error('Invalid scene description', {cause: 400});
  return scene;
}

export function getScene(req: Request, res: Response, next: any) {
  if (req.params.id.length != OBJECT_ID_LEN)
    return res.sendStatus(400);

  return getUser(req.auth)
    // do 401 a non-existant user as they don't have access to any scenes
    .then(user => userExistsOr401(user))
    .then(user => getSceneById(req.params.id, user._id.toString()))
    .then(scene => {
      if (scene) return res.status(200).send(scene)
      return res.sendStatus(404);
    })
    .catch(err => next(err));
}

export function getScenes(req: Request, res: Response, next: any) {
  // don't 401 on a non-existant user -- create them (their token has validated)
  return getOrCreateUser(req.auth)
    .then(user => getOrCreateScenes(user))
    .then(scenes => res.status(200).json(scenes))
    .catch(() => next({status: 500}));
}

export function deleteScene(req: Request, res: Response, next: any) {
  // ensure the id is reasonable
  if (req.params.id.length != OBJECT_ID_LEN)
    return res.sendStatus(400);

  return getUser(req.auth)
    .then(user => userExistsOr401(user))
    .then(user => deleteUserScene(user, req.params.id))
    .then(() => res.sendStatus(200));
}

export function createScene(req: Request, res: Response, next: any) {
  return getUser(req.auth)
    .then(user => userExistsOr401(user))
    .then(user => {
      validateScene(req.body);
      return createUserScene(user, req.body);
    })
    .then(scene => res.send(scene));
}

export function updateSceneContent(req: Request, res: Response, next: any) {
  if (req.params.id.length != OBJECT_ID_LEN)
    return res.sendStatus(400);

    return getUser(req.auth)
    .then(user => userExistsOr401(user)) // valid token but no user => 401
    .then(user => getSceneById(req.params.id, user._id.toString()))
    .then(scene => sceneExistsOr404(scene)) // valid  user but no scene => 404
    .then(scene => {
      // ensure valid layer
      if (!('layer' in req.body)) throw new Error('Unspecified layer in asset update request!', {cause: 400});
    
      const layer: string = req.body.layer.toLowerCase();
      if (!VALID_LAYERS.includes(layer)) throw new Error(`Invalid layer name in asset update request: ${layer}`, {cause: 400});

      // if there is an image upload, handle it
      if (req.file) return updateAssetFromUpload(scene, layer, req);
    
      // if there is an image, but its not in file format, assume its a link
      if ('image' in req.body) return updateAssetFromLink(scene, layer, req);

      throw new Error('No file or link in layer update request.', {cause: 406});
    })
    .then((update: LayerUpdate) => {
      if      (update.layer === 'player') return setScenePlayerContent(update.id, update.path);
      else if (update.layer === 'overlay') return setSceneOverlayContent(update.id, update.path);
      else if (update.layer === 'detail') return setSceneDetailContent(update.id, update.path);
      throw new Error(`Invalid layer ${update.layer}`, {cause: 404});
    })
    .then(scene => res.json(scene))
    .catch(err => next(err));
}

export function updateSceneViewport(req: Request, res: Response, next: any) {
  if (req.params.id.length != OBJECT_ID_LEN)
    return res.sendStatus(400);

  const vp: Rect = req.body.viewport;
  const bg: Rect = req.body.backgroundSize;
  const angle: number = req.body.angle;

  if ((angle === undefined || angle === null) && !bg && !vp)
    throw new Error(`Nothing to do`, {cause: 400});

  if (vp && !validateViewPort(vp))
    throw new Error(`Invalid height in set viewport body`, {cause: 400});

  if (bg && !validateViewPort(bg))
    throw new Error(`Invalid background rect in set viewport body`, {cause: 400});

  if (angle && !validateAngle(angle))
    throw new Error(`Invalid angle in set viewport body`, {cause: 400});

  return getUser(req.auth)
    .then(user => userExistsOr401(user))
    .then(user => getSceneById(req.params.id, user._id.toString()))
    .then(scene => setSceneViewport(scene._id.toString(), bg, vp, angle))
    .then(scene => res.json(scene))
    .catch(err => next(err));
}
