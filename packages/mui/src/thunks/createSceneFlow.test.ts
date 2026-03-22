import { Asset, Scene } from "@micahg/tbltp-common";
import { saveSceneFlow, SaveSceneFlowOps } from "./createSceneFlow";

function testScene(overrides: Partial<Scene> = {}): Scene {
  return {
    _id: "scene-1",
    user: "user-1",
    description: "test scene",
    ...overrides,
  };
}

function testAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    _id: "asset-1",
    name: "test asset",
    tags: ["scene"],
    ...overrides,
  };
}

function buildOps(overrides: Partial<SaveSceneFlowOps> = {}): SaveSceneFlowOps {
  return {
    updateAsset: jest.fn(async () => testAsset()),
    updateAssetData: jest.fn(async () => testAsset()),
    assignSceneLayerAsset: jest.fn(async ({ layer, assetId, sceneId }) =>
      testScene({
        _id: sceneId,
        ...(layer === "player" ? { playerId: assetId } : {}),
        ...(layer === "detail" ? { detailId: assetId } : {}),
        ...(layer === "overlay" ? { overlayId: assetId } : {}),
      }),
    ),
    updateSceneViewport: jest.fn(async ({ sceneId, viewport }) =>
      testScene({ _id: sceneId, viewport: viewport.viewport }),
    ),
    onScene: jest.fn(),
    onSuccess: jest.fn(),
    onFailure: jest.fn(),
    onClearCurrentScene: jest.fn(),
    ...overrides,
  };
}

describe("saveSceneFlow", () => {
  test("does not reassign an existing player layer", async () => {
    const scene = testScene({ playerId: "player-asset" });
    const ops = buildOps();

    const file = new File(["player"], "player.png", { type: "image/png" });

    await saveSceneFlow(
      {
        scene,
        player: file,
      },
      ops,
    );

    expect(ops.updateAsset).not.toHaveBeenCalled();
    expect(ops.updateAssetData).toHaveBeenCalledWith(
      expect.objectContaining({ id: "player-asset", file }),
    );
    expect(ops.assignSceneLayerAsset).not.toHaveBeenCalled();
  });

  test("assigns detail layer when creating its first asset", async () => {
    const scene = testScene();
    const createdAsset = testAsset({ _id: "detail-asset" });
    const updatedScene = testScene({ detailId: "detail-asset" });

    const ops = buildOps({
      updateAsset: jest.fn(async () => createdAsset),
      assignSceneLayerAsset: jest.fn(async () => updatedScene),
    });

    const file = new File(["detail"], "detail.png", { type: "image/png" });

    await saveSceneFlow(
      {
        scene,
        detail: file,
      },
      ops,
    );

    expect(ops.updateAsset).toHaveBeenCalledWith(
      expect.objectContaining({ name: "scene scene-1 detail" }),
    );
    expect(ops.updateAssetData).toHaveBeenCalledWith(
      expect.objectContaining({ id: "detail-asset", file }),
    );
    expect(ops.assignSceneLayerAsset).toHaveBeenCalledWith({
      sceneId: "scene-1",
      layer: "detail",
      assetId: "detail-asset",
    });
  });
});
