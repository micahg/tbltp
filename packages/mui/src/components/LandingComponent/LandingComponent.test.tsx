import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import "@testing-library/jest-dom";
import LandingComponent from "./LandingComponent";

describe("<LandingComponent />", () => {
  test("renders the landing page content", () => {
    render(
      <MemoryRouter>
        <LandingComponent />
      </MemoryRouter>,
    );

    expect(screen.getByText("tbltp.dev")).toBeInTheDocument();
    expect(screen.getByText("Disclaimer")).toBeInTheDocument();
    expect(
      screen.getByText(/Redirecting to Table-Top Display 5/),
    ).toBeInTheDocument();
  });
});
