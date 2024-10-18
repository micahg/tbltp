import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssetsComponent from "./AssetsComponent"; // Ensure the correct path to the component

describe("<AssetsComponent />", () => {
  test("it should mount", () => {
    render(<AssetsComponent />);

    const assetsComponent = screen.getByTestId("AssetsComponent");

    expect(assetsComponent).toBeInTheDocument();
  });
});
