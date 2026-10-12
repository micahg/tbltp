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
    deleteAsset: jest.fn(async () => undefined),
    onScene: jest.fn(),
    onSuccess: jest.fn(),
    onFailure: jest.fn(),
    onClearCurrentScene: jest.fn(),
    ...overrides,
  };
}

describe("saveSceneFlow", () => {
  test("creates a replacement asset when the player layer already has one", async () => {
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

    // assets are immutable once uploaded, so the changed image is uploaded
    // to a new asset and the layer is reassigned; the replacement name must
    // not collide with the still-existing old asset
    expect(ops.updateAsset).toHaveBeenCalledTimes(1);
    expect(ops.updateAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/^scene scene-1 player \d+$/),
        tags: ["scene"],
      }),
    );
    expect(ops.updateAssetData).toHaveBeenCalledWith(
      expect.objectContaining({ id: "asset-1", file }),
    );
    expect(ops.assignSceneLayerAsset).toHaveBeenCalledWith({
      sceneId: "scene-1",
      layer: "player",
      assetId: "asset-1",
    });

    // the replaced asset is best effort deleted once the reassignment lands
    expect(ops.deleteAsset).toHaveBeenCalledWith({
      _id: "player-asset",
      name: "scene scene-1 player",
    });
  });

  test("does not fail the swap when the replaced asset cannot be deleted", async () => {
    const scene = testScene({ playerId: "player-asset" });
    const ops = buildOps({
      deleteAsset: jest.fn(async () => {
        throw new Error("delete refused");
      }),
    });

    const file = new File(["player"], "player.png", { type: "image/png" });

    const saved = await saveSceneFlow(
      {
        scene,
        player: file,
      },
      ops,
    );

    expect(ops.deleteAsset).toHaveBeenCalledTimes(1);
    expect(ops.onFailure).not.toHaveBeenCalled();
    expect(ops.onSuccess).toHaveBeenCalled();
    expect(saved.playerId).toBe("asset-1");
  });

  test("forwards the viewport reset when the player image changes", async () => {
    const scene = testScene({ playerId: "player-asset" });
    const ops = buildOps();

    const file = new File(["player"], "player.png", { type: "image/png" });
    const rect = { x: 0, y: 0, width: 100, height: 50 };

    await saveSceneFlow(
      {
        scene,
        player: file,
        // the caller (SceneComponent) resets the viewport whenever the
        // player image changes, since it derives from the image dimensions
        viewport: { backgroundSize: rect, viewport: rect },
      },
      ops,
    );

    expect(ops.updateSceneViewport).toHaveBeenCalledWith({
      sceneId: "scene-1",
      viewport: { backgroundSize: rect, viewport: rect },
    });
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

    // no asset was replaced, so nothing is cleaned up
    expect(ops.deleteAsset).not.toHaveBeenCalled();
  });
});
