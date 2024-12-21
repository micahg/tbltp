import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TokenInfoDrawerComponent from "./TokenInfoDrawerComponent";

describe("<TokenInfoDrawerComponent />", () => {
  test("it should mount", () => {
    render(<TokenInfoDrawerComponent />);

    const tokenInfoDrawerComponent = screen.getByTestId(
      "TokenInfoDrawerComponent",
    );

    expect(tokenInfoDrawerComponent).toBeInTheDocument();
  });
});