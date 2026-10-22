import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContentEditor from "./ContentEditor";

jest.mock("react-redux", () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => undefined,
  useStore: () => ({}),
}));

jest.mock("../../api/scene", () => ({
  useGetScenesQuery: () => ({ data: [] }),
  useUpdateSceneOverlayDataMutation: () => [jest.fn()],
  useUpdateSceneViewportMutation: () => [jest.fn()],
}));

jest.mock("../../api/tableState", () => ({
  useUpdateTableStateMutation: () => [jest.fn()],
}));

jest.mock("../../api/scenetoken", () => ({
  useDeleteSceneTokenInstanceMutation: () => [jest.fn()],
  useGetSceneTokenInstancesQuery: () => ({ data: [] }),
  useUpsertSceneTokenInstanceMutation: () => [jest.fn()],
}));

jest.mock("../../api/asset", () => ({
  useGetAssetByIdQuery: () => ({ currentData: undefined }),
  useGetAssetsQuery: () => ({ data: [] }),
}));

jest.mock("../../api/token", () => ({
  useGetTokensQuery: () => ({ data: [] }),
}));

jest.mock(
  "../EditorIntroductionComponent/EditorIntroductionComponent.lazy",
  () => {
    const MockEditorIntroductionComponent = () => (
      <div>Editor Crash Course</div>
    );
    MockEditorIntroductionComponent.displayName =
      "MockEditorIntroductionComponent";
    return MockEditorIntroductionComponent;
  },
);

describe("<ContentEditor />", () => {
  test("renders the editor introduction when no scene is selected", () => {
    render(<ContentEditor infoDrawer={() => {}} />);

    expect(screen.getByText("Editor Crash Course")).toBeInTheDocument();
  });
});
