import { checkSchema } from "express-validator";
import { IScene, Scene } from "../models/scene";
import { IUser } from "../models/user";
import { Rect } from "@micahg/tbltp-common";
import { createUserAsset, getUserAsset } from "./asset";

export type SceneLayer = "overlay" | "detail" | "player";

function getSceneLayerAssetId(scene: IScene, layer: SceneLayer) {
  if (layer === "overlay") return scene.overlayId?.toString();
  if (layer === "detail") return scene.detailId?.toString();
  return scene.playerId?.toString();
}

export function sceneLayerAssetName(
  sceneId: string,
  layer: SceneLayer,
): string {
  return `scene-${sceneId}-${layer}`;
}

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

export function sceneLayerAssetValidator() {
  return checkSchema({
    id: {
      in: ["params"],
      isMongoId: {
        errorMessage: "Invalid scene ID",
      },
    },
    layer: {
      in: ["params"],
      isIn: {
        options: [["overlay", "detail", "player"]],
        errorMessage: "Invalid scene layer",
      },
    },
    assetId: {
      in: ["body"],
      isMongoId: {
        errorMessage: "Invalid asset ID",
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

function sceneLayerFields(layer: SceneLayer) {
  return {
    idField: `${layer}Id`,
    contentField: `${layer}Content`,
    revField: `${layer}ContentRev`,
  };
}

export function setSceneLayerContent(
  id: string,
  layer: SceneLayer,
  path: string,
) {
  const { contentField, revField } = sceneLayerFields(layer);
  return Scene.findOneAndUpdate(
    { _id: { $eq: id } },
    { $set: { [contentField]: path }, $inc: { [revField]: 1 } },
    { new: true },
  );
}

export function setSceneLayerAsset(
  id: string,
  layer: SceneLayer,
  assetId: string,
  path: string,
) {
  const { idField, contentField, revField } = sceneLayerFields(layer);
  return Scene.findOneAndUpdate(
    { _id: { $eq: id } },
    {
      $set: { [idField]: assetId, [contentField]: path },
      $inc: { [revField]: 1 },
    },
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

export async function upsertSceneLayerAsset(
  user: IUser,
  scene: IScene,
  layer: SceneLayer,
  location: string,
  incrementRevision = true,
) {
  const layerAssetId = getSceneLayerAssetId(scene, layer);
  const name = sceneLayerAssetName(scene._id.toString(), layer);

  const asset = layerAssetId ? await getUserAsset(user, layerAssetId) : null;

  if (!asset) {
    const created = await createUserAsset(user, {
      name,
      location,
      tags: ["scene"],
    });

    if (!created) {
      throw new Error("Unable to create scene asset", { cause: 500 });
    }
    return created;
  }

  const tags = asset.tags || [];
  if (!tags.includes("scene")) {
    tags.push("scene");
    asset.tags = tags;
  }

  if (asset.location !== location) {
    asset.location = location;
    if (incrementRevision) asset.revision = (asset.revision || 0) + 1;
  }

  return asset.save();
}

export async function migrateLegacySceneContentToAssets() {
  const scenes = await Scene.find({
    $or: [
      {
        $and: [
          { playerContent: { $exists: true, $ne: null } },
          { playerId: { $exists: false } },
        ],
      },
      {
        $and: [
          { detailContent: { $exists: true, $ne: null } },
          { detailId: { $exists: false } },
        ],
      },
      {
        $and: [
          { overlayContent: { $exists: true, $ne: null } },
          { overlayId: { $exists: false } },
        ],
      },
    ],
  });

  for (const scene of scenes) {
    const user = { _id: scene.user } as IUser;
    const setOps: Record<string, unknown> = {};

    if (scene.playerContent && !scene.playerId) {
      const asset = await upsertSceneLayerAsset(
        user,
        scene,
        "player",
        scene.playerContent,
        false,
      );
      setOps.playerId = asset._id;
    }

    if (scene.detailContent && !scene.detailId) {
      const asset = await upsertSceneLayerAsset(
        user,
        scene,
        "detail",
        scene.detailContent,
        false,
      );
      setOps.detailId = asset._id;
    }

    if (scene.overlayContent && !scene.overlayId) {
      const asset = await upsertSceneLayerAsset(
        user,
        scene,
        "overlay",
        scene.overlayContent,
        false,
      );
      setOps.overlayId = asset._id;
    }

    if (Object.keys(setOps).length > 0) {
      await Scene.updateOne({ _id: { $eq: scene._id } }, { $set: setOps });
    }
  }

  return scenes.length;
}
