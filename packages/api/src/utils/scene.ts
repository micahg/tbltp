import { checkSchema } from "express-validator";
import { IScene, Scene } from "../models/scene";
import { IUser } from "../models/user";
import { Rect } from "@micahg/tbltp-common";

function validateRect(value: Rect): boolean {
  if (!value) return false;
  if (typeof value !== "object") return false;
  if (!("x" in value)) return false;
  if (!("y" in value)) return false;
  if (!("width" in value)) return false;
  if (!("height" in value)) return false;
  if (
    typeof value.x !== "number" ||
    typeof value.y !== "number" ||
    typeof value.width !== "number" ||
    typeof value.height !== "number"
  ) {
    return false;
  }
  return true;
}

export function getSceneValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      isMongoId: {
        errorMessage: "Invalid scene ID",
      },
    },
  });
}

export function deleteSceneValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      isMongoId: {
        errorMessage: "Invalid scene ID",
      },
    },
  });
}

export function sceneViewportValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      isMongoId: {
        errorMessage: "Invalid scene ID",
      },
    },
    viewport: {
      in: ["body"],
      optional: true,
      custom: {
        options: (value) => validateRect(value),
        errorMessage: "Invalid viewport",
      },
    },
    backgroundSize: {
      in: ["body"],
      optional: true,
      custom: {
        options: (value) => validateRect(value),
        errorMessage: "Invalid background size",
      },
    },
    angle: {
      in: ["body"],
      optional: true,
      isInt: {
        options: { min: 0, max: 359 },
        errorMessage: "Angle must be an integer between 0 and 359",
      },
    },
  });
}

// TODO DELETE THIS
export function getSceneById(id: string, userId: string) {
  return Scene.findOne({ _id: { $eq: id }, user: userId });
}

export function getUserScene(user: IUser, id: string) {
  return Scene.findOne({
    _id: { $eq: id },
    user: { $eq: user._id },
  });
}

function getScenesByUser(user: IUser): Promise<IScene[]> {
  return Scene.find({ user: { $eq: user._id } });
}

export function setScenePlayerContent(id: string, path: string) {
  return Scene.findOneAndUpdate(
    { _id: { $eq: id } },
    { $set: { playerContent: path }, $inc: { playerContentRev: 1 } },
    { new: true },
  );
}

export function setSceneDetailContent(id: string, path: string) {
  return Scene.findOneAndUpdate(
    { _id: { $eq: id } },
    { $set: { detailContent: path }, $inc: { detailContentRev: 1 } },
    { new: true },
  );
}

export function setSceneOverlayContent(id: string, path: string) {
  return Scene.findOneAndUpdate(
    { _id: { $eq: id } },
    { $set: { overlayContent: path }, $inc: { overlayContentRev: 1 } },
    { new: true },
  );
}

function createDefaultScene(user: IUser): Promise<IScene> {
  const scene: IScene = {
    user: user._id,
    description: "default",
  };
  return Scene.create(scene);
}

export function createUserScene(user: IUser, scene: IScene): Promise<IScene> {
  scene.user = user._id;
  return Scene.create(scene);
}

export function deleteUserScene(user: IUser, sceneId: string) {
  return Scene.deleteOne({ _id: { $eq: sceneId }, user: { $eq: user._id } });
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
    getScenesByUser(user).then((scenes) => {
      if (scenes.length > 0) return resolve(scenes);
      return createDefaultScene(user).then((newScene) => resolve([newScene]));
    });
  });
}

export function setSceneViewport(
  id: string,
  bg?: Rect,
  vp?: Rect,
  angle?: number,
) {
  return Scene.findOneAndUpdate(
    { _id: { $eq: id } },
    { backgroundSize: bg, viewport: vp, angle: angle },
    { new: true },
  );
}
