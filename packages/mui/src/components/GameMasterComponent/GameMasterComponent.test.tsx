import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import GameMasterComponent from "./GameMasterComponent";

jest.mock("react-redux", () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => undefined,
  useStore: () => ({}),
}));

jest.mock("../../api/scene", () => ({
  useGetScenesQuery: () => ({ data: [] }),
}));

jest.mock("../../api/tableState", () => ({
  useGetTableStateQuery: () => ({ data: undefined }),
}));

jest.mock("../../api/scenetoken", () => ({
  sceneTokenApi: {
    usePrefetch: () => jest.fn(),
  },
}));

jest.mock("../ContentEditor/ContentEditor.lazy", () => {
  const MockContentEditor = () => <div data-testid="ContentEditor" />;
  MockContentEditor.displayName = "MockContentEditor";
  return MockContentEditor;
});

jest.mock("../SceneComponent/SceneComponent.lazy", () => () => null);
jest.mock("../AssetsComponent/AssetsComponent.lazy", () => () => null);
jest.mock("../TokensComponent/TokensComponent.lazy", () => () => null);
jest.mock("../NavigationDrawerComponent/NavigationDrawerComponent.lazy", () => {
  const MockNavigationDrawer = () => null;
  MockNavigationDrawer.displayName = "MockNavigationDrawer";
  return MockNavigationDrawer;
});

describe("<GameMasterComponent />", () => {
  test("renders the application shell and current editor", () => {
    render(<GameMasterComponent />);

    expect(screen.getByText("Network Table Top")).toBeInTheDocument();
    expect(screen.getByLabelText("open drawer")).toBeInTheDocument();
    expect(screen.getByTestId("ContentEditor")).toBeInTheDocument();
    expect(screen.getByText(/Max:/)).toBeInTheDocument();
  });
});
