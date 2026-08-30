import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssetPanelComponent from "./AssetPanelComponent";
import { Asset, AssetUsage } from "@micahg/tbltp-common";
import {
  useDeleteAssetMutation,
  useLazyGetAssetUsageQuery,
  useUpdateAssetDataMutation,
  useUpdateAssetMutation,
} from "../../api/asset";

jest.mock("../../api/asset", () => ({
  useUpdateAssetMutation: jest.fn(),
  useUpdateAssetDataMutation: jest.fn(),
  useDeleteAssetMutation: jest.fn(),
  useLazyGetAssetUsageQuery: jest.fn(),
}));

jest.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    getAccessTokenSilently: () => Promise.resolve("test-token"),
  }),
}));

jest.mock("react-redux", () => ({
  useSelector: jest.fn(() => undefined),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(),
}));

jest.mock("../DeleteWarningComponent/DeleteWarningComponent.lazy", () => {
  const MockDeleteWarningComponent = () => (
    <div data-testid="DeleteWarningComponent" />
  );
  MockDeleteWarningComponent.displayName = "MockDeleteWarningComponent";
  return MockDeleteWarningComponent;
});

const mockedUseLazyGetAssetUsageQuery = useLazyGetAssetUsageQuery as jest.Mock;
const mockedUseUpdateAssetMutation = useUpdateAssetMutation as jest.Mock;
const mockedUseUpdateAssetDataMutation =
  useUpdateAssetDataMutation as jest.Mock;
const mockedUseDeleteAssetMutation = useDeleteAssetMutation as jest.Mock;

const unusedUsage: AssetUsage = { tokens: [], scenes: [] };

function mockUsageResult(overrides?: Partial<AssetUsage>) {
  return {
    data: { ...unusedUsage, ...overrides },
    isFetching: false,
    isError: false,
  };
}

describe("<AssetPanelComponent />", () => {
  const asset: Asset = { _id: "asset1", name: "test asset" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseUpdateAssetMutation.mockReturnValue([jest.fn()]);
    mockedUseUpdateAssetDataMutation.mockReturnValue([jest.fn()]);
    mockedUseDeleteAssetMutation.mockReturnValue([jest.fn()]);
    mockedUseLazyGetAssetUsageQuery.mockReturnValue([
      jest.fn(),
      mockUsageResult(),
    ]);
  });

  test("it should mount", () => {
    render(<AssetPanelComponent asset={asset} readonly={false} />);

    const assetPanelComponent = screen.getByTestId("AssetPanelComponent");

    expect(assetPanelComponent).toBeInTheDocument();
  });

  test("it should disable the info button when the asset has no id", () => {
    render(
      <AssetPanelComponent asset={{ name: "unsaved" }} readonly={false} />,
    );

    expect(screen.getByRole("button", { name: "info" })).toBeDisabled();
  });

  test("it should fetch and show the usage section when info is clicked", () => {
    const trigger = jest.fn();
    mockedUseLazyGetAssetUsageQuery.mockReturnValue([
      trigger,
      mockUsageResult({
        tokens: [{ _id: "token1", name: "Goblin" }],
        scenes: [{ _id: "scene1", user: "user1", description: "Dungeon" }],
      }),
    ]);

    render(<AssetPanelComponent asset={asset} readonly={false} />);

    expect(screen.queryByTestId("AssetUsageSection")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "info" }));

    expect(trigger).toHaveBeenCalledWith("asset1");
    expect(screen.getByTestId("AssetUsageSection")).toBeInTheDocument();
    expect(screen.getByText(/Goblin/)).toBeInTheDocument();
    expect(screen.getByText(/Dungeon/)).toBeInTheDocument();
  });

  test("it should show an empty state when the asset is unused", () => {
    mockedUseLazyGetAssetUsageQuery.mockReturnValue([
      jest.fn(),
      mockUsageResult(),
    ]);

    render(<AssetPanelComponent asset={asset} readonly={false} />);

    fireEvent.click(screen.getByRole("button", { name: "info" }));

    expect(screen.getByText(/Not used by any tokens/)).toBeInTheDocument();
    expect(screen.getByText(/Not used in any scenes/)).toBeInTheDocument();
  });

  test("it should hide the usage section when info is clicked again", () => {
    render(<AssetPanelComponent asset={asset} readonly={false} />);

    fireEvent.click(screen.getByRole("button", { name: "info" }));
    expect(screen.getByTestId("AssetUsageSection")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "info" }));
    expect(screen.queryByTestId("AssetUsageSection")).not.toBeInTheDocument();
  });
});
