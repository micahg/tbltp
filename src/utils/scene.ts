import { IScene, Scene } from "../models/scene";
import { IUser } from "../models/user";
import { Rect } from "./tablestate";

export function getSceneById(id: string, userId: string) {
  return Scene.findOne({_id: id, user: userId});
}

function getScenesByUser(user: IUser): Promise<IScene[]> {
  return Scene.find({user: user._id})
}

export function setSceneTableContent(id: string, path: string) {
  return Scene.findOneAndUpdate({_id: id}, {$set: {playerContent: path}, $inc: {playerContentRev: 1}}, {new: true});
}

export function setSceneUserContent(id: string, path: string) {
  return Scene.findOneAndUpdate({_id: id}, {$set: {detailContent: path}, $inc: {detailContentRev: 1}}, {new: true});
}

export function setSceneOverlayContent(id: string, path: string) {
  return Scene.findOneAndUpdate({_id: id}, {$set: {overlayContent: path}, $inc: {overlayContentRev: 1}}, {new: true});
}

function createDefaultScene(user: IUser): Promise<IScene> {
  const scene: IScene = {
    user: user._id,
    description: 'default',
  }
  return Scene.create(scene);
}

export function createUserScene(user: IUser, scene: IScene): Promise<IScene> {
  scene.user = user._id;
  return Scene.create(scene);
}

export function deleteUserScene(user: IUser, sceneId: string) {
  return Scene.deleteOne({_id: sceneId, user: user._id});
}

/**
 * Get the scenes for this user, create a default scene if they have none.
 *
 * @todo consider the campaign
 * @param user The user for which to get/create scenes.
 * @returns A promise returning a list of scenes
 */
export function getOrCreateScenes(user: IUser): Promise<IScene[]> {
  return new Promise((resolve) => {
    getScenesByUser(user)
      .then(scenes => {
        if (scenes.length > 0) return resolve(scenes);
        return createDefaultScene(user).then(newScene => resolve([newScene]));
      });
  });
}

export function setSceneViewport(id: string, bg?: Rect, vp?: Rect) {
  return Scene.findOneAndUpdate({_id: id}, {backgroundSize: bg, viewport: vp}, {new: true});
}