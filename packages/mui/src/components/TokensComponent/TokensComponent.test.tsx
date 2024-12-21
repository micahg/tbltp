import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TokensComponent from "./TokensComponent";

describe("<TokensComponent />", () => {
  test("it should mount", () => {
    render(<TokensComponent />);

    const tokensComponent = screen.getByTestId("TokensComponent");

    expect(tokensComponent).toBeInTheDocument();
  });
});
