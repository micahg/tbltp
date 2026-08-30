import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeleteWarningComponent from "./DeleteWarningComponent";
import { Asset } from "@micahg/tbltp-common";
import { useGetScenesQuery } from "../../api/scene";
import { useLazyGetSceneTokenInstancesQuery } from "../../api/scenetoken";
import { useLazyGetAssetUsageQuery } from "../../api/asset";

jest.mock("../../api/scene", () => ({
  useGetScenesQuery: jest.fn(),
}));
jest.mock("../../api/scenetoken", () => ({
  useLazyGetSceneTokenInstancesQuery: jest.fn(),
}));
jest.mock("../../api/asset", () => ({
  useLazyGetAssetUsageQuery: jest.fn(),
}));

const mockedUseGetScenesQuery = useGetScenesQuery as jest.Mock;
const mockedUseLazyGetSceneTokenInstancesQuery =
  useLazyGetSceneTokenInstancesQuery as jest.Mock;
const mockedUseLazyGetAssetUsageQuery = useLazyGetAssetUsageQuery as jest.Mock;

describe("<DeleteWarningComponent />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseGetScenesQuery.mockReturnValue({ data: [] });
    mockedUseLazyGetSceneTokenInstancesQuery.mockReturnValue([jest.fn()]);
    mockedUseLazyGetAssetUsageQuery.mockReturnValue([
      jest.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ tokens: [], scenes: [] }),
      }),
    ]);
  });

  test("it should mount", () => {
    render(
      <DeleteWarningComponent
        open={false}
        deletionType={"test"}
        handleClose={() => null}
        handleDelete={() => null}
      />,
    );

    const deleteWarningComponent = screen.getByTestId("DeleteWarningComponent");

    expect(deleteWarningComponent).toBeInTheDocument();
  });

  test("it should check asset usage before warning", async () => {
    const trigger = jest.fn().mockReturnValue({
      unwrap: () => Promise.resolve({ tokens: [], scenes: [] }),
    });
    mockedUseLazyGetAssetUsageQuery.mockReturnValue([trigger]);

    const entity: Asset = { _id: "asset1", name: "test asset" };
    const handleDelete = jest.fn();

    render(
      <DeleteWarningComponent
        open={true}
        deletionType={"Asset"}
        entity={entity}
        handleClose={() => null}
        handleDelete={handleDelete}
      />,
    );

    // the usage check should be kicked off for the asset
    await waitFor(() => expect(trigger).toHaveBeenCalledWith("asset1"));

    // an unused asset should be deleted without a warning
    await waitFor(() => expect(handleDelete).toHaveBeenCalled());
  });

  test("it should warn instead of deleting an asset in use", async () => {
    const trigger = jest.fn().mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          tokens: [{ _id: "token1", name: "Goblin" }],
          scenes: [{ _id: "scene1", user: "user1", description: "Dungeon" }],
        }),
    });
    mockedUseLazyGetAssetUsageQuery.mockReturnValue([trigger]);

    const entity: Asset = { _id: "asset1", name: "test asset" };
    const handleDelete = jest.fn();

    render(
      <DeleteWarningComponent
        open={true}
        deletionType={"Asset"}
        entity={entity}
        handleClose={() => null}
        handleDelete={handleDelete}
      />,
    );

    await waitFor(() => expect(trigger).toHaveBeenCalledWith("asset1"));
    await waitFor(() => expect(screen.getByText(/Goblin/)).toBeInTheDocument());
    expect(screen.getByText(/Dungeon/)).toBeInTheDocument();
    expect(handleDelete).not.toHaveBeenCalled();
  });
});
