import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CreateTokenFormComponent from "./CreateTokenFormComponent";

jest.mock("react-redux", () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => undefined,
  useStore: () => ({}),
}));

jest.mock("../../api/asset", () => ({
  useGetAssetsQuery: () => ({ data: [] }),
  usePresignAssetUrlsMutation: () => [jest.fn()],
  useUpdateAssetMutation: () => [jest.fn()],
  useUpdateAssetDataMutation: () => [jest.fn()],
  useDeleteAssetMutation: () => [jest.fn()],
}));

jest.mock("../../api/token", () => ({
  useUpdateTokenMutation: () => [jest.fn()],
  useDeleteTokenMutation: () => [jest.fn()],
}));

jest.mock("../DeleteWarningComponent/DeleteWarningComponent.lazy", () => {
  const MockDeleteWarningComponent = () => null;
  MockDeleteWarningComponent.displayName = "MockDeleteWarningComponent";
  return MockDeleteWarningComponent;
});

describe("<CreateTokenFormComponent />", () => {
  test("it should render an empty token form", () => {
    render(<CreateTokenFormComponent />);

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByAltText("Asset Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "delete" })).toBeEnabled();
  });
});
