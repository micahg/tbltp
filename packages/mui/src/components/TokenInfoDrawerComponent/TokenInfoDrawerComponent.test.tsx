import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TokenInfoDrawerComponent from "./TokenInfoDrawerComponent";

describe("<TokenInfoDrawerComponent />", () => {
  test("it should render the token actions", () => {
    render(
      <TokenInfoDrawerComponent
        onToken={() => {}}
        onDelete={() => {}}
        onMove={() => {}}
      />,
    );

    expect(screen.getByText("Add Token")).toBeInTheDocument();
    expect(screen.getByText("Move Token")).toBeInTheDocument();
    expect(screen.getByText("Create Token")).toBeInTheDocument();
    expect(screen.getByText("Delete Token")).toBeInTheDocument();
  });
});
