import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import UnavailableComponent from "./UnavailableComponent";

describe("<UnavailableComponent />", () => {
  test("it should mount", () => {
    render(<UnavailableComponent />);
    const errorMessage = screen.getByText("... is Unavailable ... sorry!");
    expect(errorMessage).toBeInTheDocument();
  });

  test("it should display an error message", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { search: "?error=dGhpcwppcwphbgplcnJvcg==" },
    });
    render(<UnavailableComponent />);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "CODE" &&
          element?.textContent === "this\nis\nan\nerror",
      ),
    ).toBeInTheDocument();
  });
});
