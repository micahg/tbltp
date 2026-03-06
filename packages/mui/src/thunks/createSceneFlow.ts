import { Scene } from "@micahg/tbltp-common";
import { SceneViewportUpdate, SendSceneFileArgs } from "../api/scene";
import { LoadProgress } from "../utils/content";

export interface CreateSceneFlowArgs {
  description: string;
  player: File;
  detail?: File;
  viewport?: SceneViewportUpdate["viewport"];
  playerProgress?: (evt: LoadProgress) => void;
  detailProgress?: (evt: LoadProgress) => void;
}

export interface CreateSceneFlowOps {
  createScene: (payload: { description: string }) => Promise<Scene>;
  sendSceneFile: (payload: SendSceneFileArgs) => Promise<Scene>;
  updateSceneViewport: (payload: SceneViewportUpdate) => Promise<Scene>;
  deleteScene: (sceneId: string) => Promise<void>;
  onScene: (scene: Scene) => void;
  onSuccess: () => void;
  onFailure: (message: string) => void;
  onClearCurrentScene: () => void;
}

export type CreateSceneFlowLifecycleOps = Pick<
  CreateSceneFlowOps,
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

export async function createSceneFlow(
  args: CreateSceneFlowArgs,
  ops: CreateSceneFlowOps,
): Promise<Scene> {
  let createdScene: Scene | undefined;
  try {
    createdScene = await ops.createScene({ description: args.description });

    if (!createdScene._id) {
      throw new Error("Created scene missing id");
    }

    ops.onScene(createdScene);

    createdScene = await ops.sendSceneFile({
      scene: createdScene,
      blob: args.player,
      layer: "player",
      progress: args.playerProgress,
    });
    ops.onScene(createdScene);

    if (args.detail) {
      createdScene = await ops.sendSceneFile({
        scene: createdScene,
        blob: args.detail,
        layer: "detail",
        progress: args.detailProgress,
      });
      ops.onScene(createdScene);
    }

    if (args.viewport && createdScene._id) {
      createdScene = await ops.updateSceneViewport({
        sceneId: createdScene._id,
        viewport: args.viewport,
      });
      ops.onScene(createdScene);
    }

    ops.onSuccess();
    return createdScene;
  } catch (err) {
    ops.onFailure(errorMessage(err));

    if (createdScene?._id) {
      try {
        await ops.deleteScene(createdScene._id);
      } catch {
        // ignore cleanup errors so we still surface the original failure
      }

      ops.onClearCurrentScene();
    }

    throw err;
  }
}
