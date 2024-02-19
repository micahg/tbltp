import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import GameMasterActionComponent from "./GameMasterActionComponent";

describe("<GameMasterActionComponent />", () => {
  test("it should mount", () => {
    render(<GameMasterActionComponent />);

    const gameMasterActionComponent = screen.getByTestId(
      "GameMasterActionComponent",
    );

    expect(gameMasterActionComponent).toBeInTheDocument();
  });
});
