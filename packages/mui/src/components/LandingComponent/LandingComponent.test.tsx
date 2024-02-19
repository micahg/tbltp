import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import LandingComponent from "./LandingComponent";

describe("<LandingComponent />", () => {
  test("it should mount", () => {
    render(<LandingComponent />);

    const landingComponent = screen.getByTestId("LandingComponent");

    expect(landingComponent).toBeInTheDocument();
  });
});
