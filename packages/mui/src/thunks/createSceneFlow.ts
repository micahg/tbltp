import { Asset, Scene } from "@micahg/tbltp-common";
import {
  AssignSceneLayerAssetArgs,
  SceneLayer,
  SceneViewportUpdate,
} from "../api/scene";
import { UpdateAssetDataRequest } from "../api/asset";
import { LoadProgress } from "../utils/content";
import { errorMessageForCreateError } from "../utils/errors";

export interface SaveSceneFlowArgs {
  scene?: Scene;
  description?: string;
  player?: File;
  detail?: File;
  viewport?: SceneViewportUpdate["viewport"];
  playerProgress?: (evt: LoadProgress) => void;
  detailProgress?: (evt: LoadProgress) => void;
}

export interface SaveSceneFlowOps {
  createScene?: (payload: { description: string }) => Promise<Scene>;
  updateAsset: (payload: Asset) => Promise<Asset>;
  updateAssetData: (payload: UpdateAssetDataRequest) => Promise<Asset>;
  assignSceneLayerAsset: (payload: AssignSceneLayerAssetArgs) => Promise<Scene>;
  updateSceneViewport: (payload: SceneViewportUpdate) => Promise<Scene>;
  deleteScene?: (sceneId: string) => Promise<void>;
  deleteAsset?: (asset: Asset) => Promise<unknown>;
  onScene: (scene: Scene) => void;
  onSuccess: () => void;
  onFailure: (message: string) => void;
  onClearCurrentScene: () => void;
}

export type SaveSceneFlowLifecycleOps = Pick<
  SaveSceneFlowOps,
  "onScene" | "onSuccess" | "onFailure" | "onClearCurrentScene"
>;

function layerAssetName(sceneId: string, layer: SceneLayer): string {
  return `scene ${sceneId} ${layer}`;
}

/**
 * The unique (user, name) asset index forbids reusing the standard layer
 * asset name while the previously assigned asset still exists, so
 * replacement names get a timestamp suffix to stay unique.
 */
function replacementLayerAssetName(sceneId: string, layer: SceneLayer): string {
  return `${layerAssetName(sceneId, layer)} ${Date.now()}`;
}

async function saveLayerAsset(
  scene: Scene,
  layer: SceneLayer,
  file: File,
  progress: ((evt: LoadProgress) => void) | undefined,
  ops: SaveSceneFlowOps,
): Promise<{ scene: Scene; createdAsset: Asset }> {
  const existingAssetId =
    layer === "player"
      ? scene.playerId
      : layer === "detail"
        ? scene.detailId
        : scene.overlayId;

  // assets are immutable once their data is uploaded, so a changed layer
  // image always gets a brand new asset and the layer is reassigned to it
  const created = await ops.updateAsset({
    name: existingAssetId
      ? replacementLayerAssetName(scene._id!, layer)
      : layerAssetName(scene._id!, layer),
    tags: ["scene"],
  });
  if (!created?._id) {
    throw new Error("Created asset missing id");
  }

  await ops.updateAssetData({
    id: created._id,
    file,
    progress,
  });

  const updatedScene = await ops.assignSceneLayerAsset({
    sceneId: scene._id!,
    layer,
    assetId: created._id,
  });

  // the replaced asset is orphaned by the reassignment -- best effort
  // delete it so it does not linger. if it is still referenced elsewhere
  // (another scene layer or a token image) the API refuses (409) and it
  // is left behind for manual cleanup
  if (existingAssetId && ops.deleteAsset) {
    await ops
      .deleteAsset({
        _id: existingAssetId,
        name: layerAssetName(scene._id!, layer),
      })
      .catch(() => {
        // ignore cleanup errors -- the swap itself already succeeded
      });
  }

  return { scene: updatedScene, createdAsset: created };
}

export async function saveSceneFlow(
  args: SaveSceneFlowArgs,
  ops: SaveSceneFlowOps,
): Promise<Scene> {
  const isCreate = !args.scene;
  let scene: Scene | undefined = args.scene;
  const createdAssets: Asset[] = [];

  if (isCreate && (!args.description || !args.player)) {
    const err = new Error("Create flow requires description and player file");
    ops.onFailure(errorMessageForCreateError(err));
    throw err;
  }

  if (!isCreate && !scene?._id) {
    const err = new Error("Scene missing id");
    ops.onFailure(errorMessageForCreateError(err));
    throw err;
  }

  try {
    if (isCreate) {
      if (!ops.createScene) {
        throw new Error("Create operation not configured");
      }
      scene = await ops.createScene({ description: args.description! });

      if (!scene._id) {
        throw new Error("Created scene missing id");
      }

      ops.onScene(scene);
    }

    if (args.player && scene) {
      const result = await saveLayerAsset(
        scene,
        "player",
        args.player,
        args.playerProgress,
        ops,
      );
      scene = result.scene;
      createdAssets.push(result.createdAsset);
      ops.onScene(scene);
    }

    if (args.detail && scene) {
      const result = await saveLayerAsset(
        scene,
        "detail",
        args.detail,
        args.detailProgress,
        ops,
      );
      scene = result.scene;
      createdAssets.push(result.createdAsset);
      ops.onScene(scene);
    }

    if (args.viewport && scene?._id) {
      scene = await ops.updateSceneViewport({
        sceneId: scene._id,
        viewport: args.viewport,
      });
      ops.onScene(scene);
    }

    if (!scene) {
      throw new Error("Unable to save scene");
    }

    ops.onSuccess();
    return scene;
  } catch (err) {
    ops.onFailure(errorMessageForCreateError(err));

    if (ops.deleteAsset && createdAssets.length > 0) {
      await Promise.all(
        createdAssets
          .filter((asset) => !!asset._id)
          .map((asset) =>
            ops.deleteAsset!(asset).catch(() => {
              // ignore cleanup errors so we still surface the original failure
            }),
          ),
      );
    }

    if (isCreate && scene?._id && ops.deleteScene) {
      try {
        await ops.deleteScene(scene._id);
      } catch {
        // ignore cleanup errors so we still surface the original failure
      }

      ops.onClearCurrentScene();
    }

    throw err;
  }
}

// Backward-compatible alias for existing callsites.
export const createSceneFlow = saveSceneFlow;
