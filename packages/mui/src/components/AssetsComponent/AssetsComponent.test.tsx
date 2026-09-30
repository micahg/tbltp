import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssetsComponent from "./AssetsComponent";
import { Asset, Scene, Token } from "@micahg/tbltp-common";
import { useGetAssetsQuery, useUpdateAssetMutation } from "../../api/asset";
import { useGetScenesQuery } from "../../api/scene";
import { useGetTokensQuery } from "../../api/token";

jest.mock("../../api/asset", () => ({
  useGetAssetsQuery: jest.fn(),
  useUpdateAssetMutation: jest.fn(),
}));

jest.mock("../../api/scene", () => ({
  useGetScenesQuery: jest.fn(),
}));

jest.mock("../../api/token", () => ({
  useGetTokensQuery: jest.fn(),
}));

jest.mock("../AssetPanelComponent/AssetPanelComponent.lazy", () => {
  const MockAssetPanelComponent = ({
    asset,
    used,
  }: {
    asset: Asset;
    used?: boolean;
  }) => (
    <div
      data-testid={`AssetPanelComponent-${asset.name}`}
      data-used={String(used)}
    >
      {asset.name}
    </div>
  );
  MockAssetPanelComponent.displayName = "MockAssetPanelComponent";
  return MockAssetPanelComponent;
});

jest.mock("../ErrorAlertComponent/ErrorAlertComponent.lazy", () => {
  const MockErrorAlertComponent = () => (
    <div data-testid="ErrorAlertComponent" />
  );
  MockErrorAlertComponent.displayName = "MockErrorAlertComponent";
  return MockErrorAlertComponent;
});

const mockedUseGetAssetsQuery = useGetAssetsQuery as jest.Mock;
const mockedUseGetScenesQuery = useGetScenesQuery as jest.Mock;
const mockedUseGetTokensQuery = useGetTokensQuery as jest.Mock;
const mockedUseUpdateAssetMutation = useUpdateAssetMutation as jest.Mock;

const assets: Asset[] = [
  { _id: "unused-asset", name: "Unused Asset" },
  { _id: "token-asset", name: "Token Asset" },
  { _id: "scene-asset", name: "Scene Asset" },
  { _id: "both-asset", name: "Both Asset" },
];
const tokens: Token[] = [
  { _id: "token1", name: "Goblin", asset: "token-asset" },
  { _id: "token2", name: "Orc", asset: "both-asset" },
  { _id: "token3", name: "Ghost" },
];
const scenes: Scene[] = [
  {
    _id: "scene1",
    user: "user1",
    description: "Dungeon",
    overlayId: "scene-asset",
  },
  {
    _id: "scene2",
    user: "user1",
    description: "Cave",
    detailId: "both-asset",
  },
];

function expectAssets(visible: string[]) {
  for (const asset of assets) {
    if (visible.includes(asset.name)) {
      expect(screen.getByText(asset.name)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(asset.name)).not.toBeInTheDocument();
    }
  }
}

function expectUsed(name: string, used: boolean) {
  expect(screen.getByTestId(`AssetPanelComponent-${name}`)).toHaveAttribute(
    "data-used",
    String(used),
  );
}

describe("<AssetsComponent />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseGetAssetsQuery.mockReturnValue({ data: assets });
    mockedUseGetScenesQuery.mockReturnValue({ data: scenes });
    mockedUseGetTokensQuery.mockReturnValue({ data: tokens });
    mockedUseUpdateAssetMutation.mockReturnValue([jest.fn()]);
  });

  test("it should mount", () => {
    render(<AssetsComponent />);

    const assetsComponent = screen.getByTestId("AssetsComponent");

    expect(assetsComponent).toBeInTheDocument();
  });

  test("it should show all assets when no filter is selected", () => {
    render(<AssetsComponent />);

    expectAssets(["Unused Asset", "Token Asset", "Scene Asset", "Both Asset"]);
  });

  test("it should show only unused assets when unused is selected", () => {
    render(<AssetsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Unused" }));

    expectAssets(["Unused Asset"]);
  });

  test("it should show only assets used by tokens when token is selected", () => {
    render(<AssetsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Token" }));

    expectAssets(["Token Asset", "Both Asset"]);
  });

  test("it should show only assets used by scenes when scene is selected", () => {
    render(<AssetsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Scene" }));

    expectAssets(["Scene Asset", "Both Asset"]);
  });

  test("token and scene combine as a union", () => {
    render(<AssetsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Token" }));
    fireEvent.click(screen.getByRole("button", { name: "Scene" }));

    expectAssets(["Token Asset", "Scene Asset", "Both Asset"]);
  });

  test("selecting unused clears token and scene", () => {
    render(<AssetsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Token" }));
    fireEvent.click(screen.getByRole("button", { name: "Scene" }));
    fireEvent.click(screen.getByRole("button", { name: "Unused" }));

    expectAssets(["Unused Asset"]);
  });

  test("selecting token or scene clears unused", () => {
    render(<AssetsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Unused" }));
    fireEvent.click(screen.getByRole("button", { name: "Token" }));

    expectAssets(["Token Asset", "Both Asset"]);
  });

  test("deselecting every filter shows all assets", () => {
    render(<AssetsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Unused" }));
    fireEvent.click(screen.getByRole("button", { name: "Unused" }));

    expectAssets(["Unused Asset", "Token Asset", "Scene Asset", "Both Asset"]);
  });

  test("it should tell each panel whether its asset is used", () => {
    render(<AssetsComponent />);

    expectUsed("Unused Asset", false);
    expectUsed("Token Asset", true);
    expectUsed("Scene Asset", true);
    expectUsed("Both Asset", true);
  });
});
