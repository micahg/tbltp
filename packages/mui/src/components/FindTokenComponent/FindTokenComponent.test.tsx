import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FindTokenComponent from "./FindTokenComponent";

jest.mock("react-redux", () => ({
  useSelector: () => "scene1",
  useStore: () => ({}),
}));

jest.mock("../../api/token", () => ({
  useGetTokensQuery: () => ({
    data: [{ _id: "token1", name: "Goblin", asset: "asset1" }],
  }),
}));

jest.mock("../../api/asset", () => ({
  useGetAssetsQuery: () => ({
    data: [
      {
        _id: "asset1",
        name: "Goblin art",
        location: "public/goblin.png",
        url: "https://example.test/goblin.png",
      },
    ],
  }),
}));

jest.mock("../../api/scene", () => ({
  useGetScenesQuery: () => ({
    data: [{ _id: "scene1", description: "Dungeon" }],
  }),
}));

describe("<FindTokenComponent />", () => {
  test("lists tokens and emits a hydrated instance when selected", () => {
    const onToken = jest.fn();
    render(<FindTokenComponent onToken={onToken} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByText("Goblin")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Goblin"));

    expect(onToken).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Goblin",
        scene: "scene1",
        token: "token1",
        asset: "public/goblin.png",
        assetUrl: "https://example.test/goblin.png",
        visible: true,
      }),
    );
  });
});
