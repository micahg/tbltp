import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import "@testing-library/jest-dom";
import DeviceCodeComponent from "./DeviceCodeComponent";

jest.mock("../../api/environment", () => ({
  useGetAuthConfigQuery: () => ({ data: undefined }),
}));

jest.mock("../../api/devicecode", () => ({
  useGetDeviceAuthStateQuery: () => ({ data: undefined }),
  useGetDeviceCodeMutation: () => [jest.fn()],
  usePollDeviceCodeMutation: () => [jest.fn()],
}));

describe("<DeviceCodeComponent />", () => {
  test("renders the device authorization instructions", () => {
    render(
      <MemoryRouter>
        <DeviceCodeComponent />
      </MemoryRouter>,
    );

    expect(screen.getByText("Network Table Top")).toBeInTheDocument();
    expect(screen.getByText("Authentication Required")).toBeInTheDocument();
    expect(screen.getAllByText("Fetching...").length).toBeGreaterThan(0);
  });
});
