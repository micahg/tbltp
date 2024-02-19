import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import GameMasterComponent from "./GameMasterComponent";

describe("<GameMasterComponent />", () => {
  test("it should mount", () => {
    render(<GameMasterComponent />);

    const gameMasterComponent = screen.getByTestId("GameMasterComponent");

    expect(gameMasterComponent).toBeInTheDocument();
  });
});
