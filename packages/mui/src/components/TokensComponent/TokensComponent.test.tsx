import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TokensComponent from "./TokensComponent";

jest.mock("react-redux", () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => undefined,
  useStore: () => ({}),
}));

jest.mock("../../api/token", () => {
  const updateToken = jest.fn();
  return {
    useGetTokensQuery: () => ({ data: [] }),
    useUpdateTokenMutation: () => [updateToken],
  };
});

jest.mock("../ErrorAlertComponent/ErrorAlertComponent.lazy", () => {
  const MockErrorAlertComponent = () => null;
  MockErrorAlertComponent.displayName = "MockErrorAlertComponent";
  return MockErrorAlertComponent;
});

describe("<TokensComponent />", () => {
  test("renders the token list and publishes toolbar actions", () => {
    const populateToolbar = jest.fn();

    render(<TokensComponent populateToolbar={populateToolbar} />);

    expect(screen.getByText(/Need tokens/)).toBeInTheDocument();
    expect(populateToolbar).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tooltip: "Create Token" }),
      ]),
    );
  });
});
