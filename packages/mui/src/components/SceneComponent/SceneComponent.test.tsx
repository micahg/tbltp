import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SceneComponent from "./SceneComponent";

jest.mock("react-redux", () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => undefined,
  useStore: () => ({}),
}));

jest.mock("../../api/scene", () => ({
  useCreateSceneMutation: () => [jest.fn()],
  useUpdateSceneViewportMutation: () => [jest.fn()],
  useDeleteSceneMutation: () => [jest.fn()],
  useAssignSceneLayerAssetMutation: () => [jest.fn()],
}));

jest.mock("../../api/asset", () => ({
  useUpdateAssetMutation: () => [jest.fn()],
  useGetAssetByIdQuery: () => ({ data: undefined }),
  useUpdateAssetDataMutation: () => [jest.fn()],
  useDeleteAssetMutation: () => [jest.fn()],
}));

jest.mock("../../utils/presignedUrl", () => ({
  usePresignedUrlRefresher: () => jest.fn(),
}));

jest.mock("../../thunks/createSceneFlow", () => ({
  saveSceneFlow: jest.fn(),
}));

jest.mock("../ErrorAlertComponent/ErrorAlertComponent.lazy", () => {
  const MockErrorAlertComponent = () => null;
  MockErrorAlertComponent.displayName = "MockErrorAlertComponent";
  return MockErrorAlertComponent;
});

describe("<SceneComponent />", () => {
  test("renders the scene creation form", () => {
    render(<SceneComponent />);

    expect(screen.getByLabelText("Scene Name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Player Background" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Detailed Background" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});
