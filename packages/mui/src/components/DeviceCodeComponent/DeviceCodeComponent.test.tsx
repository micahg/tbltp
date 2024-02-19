import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import DeviceCodeComponent from "./DeviceCodeComponent";

describe("<DeviceCodeComponent />", () => {
  test("it should mount", () => {
    render(<DeviceCodeComponent />);

    const deviceCodeComponent = screen.getByTestId("DeviceCodeComponent");

    expect(deviceCodeComponent).toBeInTheDocument();
  });
});
