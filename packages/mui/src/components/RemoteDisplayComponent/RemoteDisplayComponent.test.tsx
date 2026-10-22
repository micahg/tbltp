import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import "@testing-library/jest-dom";
import RemoteDisplayComponent from "./RemoteDisplayComponent";

jest.mock("../../api/environment", () => {
  const environmentConfig = {
    api: "http://localhost:3000",
    ws: "ws://localhost:3000",
  };
  const noAuthConfig = { noauth: true };
  const authConfig = { domain: "example.auth0.com", clientId: "client-id" };
  const refetch = jest.fn();
  return {
    useGetEnvironmentConfigQuery: () => ({
      data: environmentConfig,
      refetch,
    }),
    useGetNoAuthConfigQuery: () => ({
      data: noAuthConfig,
      refetch,
    }),
    useGetAuthConfigQuery: () => ({ data: authConfig }),
  };
});

jest.mock("../../api/devicecode", () => {
  const pollDeviceCode = jest.fn();
  const authState = { token: "NOAUTH" };
  return {
    useGetDeviceAuthStateQuery: () => ({ data: authState }),
    usePollDeviceCodeMutation: () => [pollDeviceCode],
  };
});

describe("<RemoteDisplayComponent />", () => {
  test("renders the display canvas", () => {
    render(
      <MemoryRouter>
        <RemoteDisplayComponent />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Unable to connect/)).toBeInTheDocument();
    expect(
      screen.getByText(/Sorry, your browser does not support canvas/),
    ).toBeInTheDocument();
  });
});
