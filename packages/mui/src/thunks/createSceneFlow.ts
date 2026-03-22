import { Asset, Scene } from "@micahg/tbltp-common";
import {
  AssignSceneLayerAssetArgs,
  SceneLayer,
  SceneViewportUpdate,
} from "../api/scene";
import { UpdateAssetDataRequest } from "../api/asset";
import { LoadProgress } from "../utils/content";

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

function inferStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return;
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number") return status;

  const error = (err as { error?: unknown }).error;
  const message = typeof error === "string" ? error : String(err);
  const code = message.match(/status\s+(\d{3})/i)?.[1];
  return code ? Number(code) : undefined;
}

function errorMessage(err: unknown): string {
  const status = inferStatus(err);
  if (status === 413) return "Asset too big";
  if (status === 406) return "Invalid asset format";
  return "Unkown error happened";
}

function layerAssetName(sceneId: string, layer: SceneLayer): string {
  return `scene ${sceneId} ${layer}`;
}

async function saveLayerAsset(
  scene: Scene,
  layer: SceneLayer,
  file: File,
  progress: ((evt: LoadProgress) => void) | undefined,
  ops: SaveSceneFlowOps,
): Promise<{ scene: Scene; createdAsset?: Asset }> {
  const existingAssetId =
    layer === "player"
      ? scene.playerId
      : layer === "detail"
        ? scene.detailId
        : scene.overlayId;

  let createdAsset: Asset | undefined;
  let assetId = existingAssetId;

  if (!assetId) {
    const created = await ops.updateAsset({
      name: layerAssetName(scene._id!, layer),
      tags: ["scene"],
    });
    if (!created?._id) {
      throw new Error("Created asset missing id");
    }
    createdAsset = created;
    assetId = created._id;
  }

  await ops.updateAssetData({
    id: assetId,
    file,
    progress,
  });

  const updatedScene = createdAsset
    ? await ops.assignSceneLayerAsset({
        sceneId: scene._id!,
        layer,
        assetId,
      })
    : scene;

  return { scene: updatedScene, createdAsset };
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
    ops.onFailure(errorMessage(err));
    throw err;
  }

  if (!isCreate && !scene?._id) {
    const err = new Error("Scene missing id");
    ops.onFailure(errorMessage(err));
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
      if (result.createdAsset) createdAssets.push(result.createdAsset);
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
      if (result.createdAsset) createdAssets.push(result.createdAsset);
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
    ops.onFailure(errorMessage(err));

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
