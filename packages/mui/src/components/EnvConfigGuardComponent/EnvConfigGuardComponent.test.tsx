import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import EnvConfigGuardComponent from "./EnvConfigGuardComponent";
import {
  useGetAuthConfigQuery,
  useGetNoAuthConfigQuery,
  useGetEnvironmentConfigQuery,
} from "../../api/environment";

jest.mock("../../api/environment", () => ({
  useGetEnvironmentConfigQuery: jest.fn(),
  useGetAuthConfigQuery: jest.fn(),
  useGetNoAuthConfigQuery: jest.fn(),
}));

jest.mock("../GameMasterComponent/GameMasterComponent.lazy", () => () => (
  <div data-testid="GameMasterComponent" />
));

jest.mock(
  "../AuthenticationGuardComponent/AuthenticationGuardComponent.lazy",
  () => () => <div data-testid="AuthenticationGuardComponent" />,
);

jest.mock("@auth0/auth0-react", () => ({
  Auth0Provider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="Auth0Provider">{children}</div>
  ),
}));

const mockedUseGetEnvironmentConfigQuery =
  useGetEnvironmentConfigQuery as jest.Mock;
const mockedUseGetAuthConfigQuery = useGetAuthConfigQuery as jest.Mock;
const mockedUseGetNoAuthConfigQuery = useGetNoAuthConfigQuery as jest.Mock;

describe("<EnvConfigGuardComponent />", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isUninitialized: false,
    });
  });

  test("shows loading until environment config is available", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({ data: undefined });
    mockedUseGetAuthConfigQuery.mockReturnValue({ data: undefined });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isUninitialized: true,
    });

    render(<EnvConfigGuardComponent />);

    expect(screen.getByText("Waiting for api config...")).toBeInTheDocument();
    expect(mockedUseGetNoAuthConfigQuery).toHaveBeenCalledWith(undefined, {
      skip: true,
    });
  });

  test("shows loading while noauth config is loading", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: { api: "http://localhost:3000", ws: "ws://localhost:3000" },
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({ data: undefined });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      isUninitialized: false,
    });

    render(<EnvConfigGuardComponent />);

    expect(
      screen.getByText("Waiting for noauth config..."),
    ).toBeInTheDocument();
    expect(mockedUseGetNoAuthConfigQuery).toHaveBeenCalledWith(undefined, {
      skip: false,
    });
  });

  test("renders game master directly when noauth is enabled", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: { api: "http://localhost:3000", ws: "ws://localhost:3000" },
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({ data: undefined });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: { noauth: true },
    });

    render(<EnvConfigGuardComponent />);

    expect(screen.getByTestId("GameMasterComponent")).toBeInTheDocument();
    expect(screen.queryByTestId("Auth0Provider")).not.toBeInTheDocument();
  });

  test("shows loading when auth is required but auth config is missing", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: { api: "http://localhost:3000", ws: "ws://localhost:3000" },
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({ data: undefined });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: { noauth: false },
      isLoading: false,
      isFetching: false,
      isUninitialized: false,
    });

    render(<EnvConfigGuardComponent />);

    expect(screen.getByText("Waiting for auth config...")).toBeInTheDocument();
  });

  test("renders auth wrapper, token bridge, and game master when auth config is present", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: { api: "http://localhost:3000", ws: "ws://localhost:3000" },
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({
      data: {
        domain: "example.auth0.com",
        clientId: "client-id",
        authorizationParams: {
          audience: "audience",
          redirect_uri: "http://localhost",
        },
      },
    });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: { noauth: false },
      isLoading: false,
      isFetching: false,
      isUninitialized: false,
    });

    render(<EnvConfigGuardComponent />);

    expect(screen.getByTestId("Auth0Provider")).toBeInTheDocument();
    expect(
      screen.getByTestId("AuthenticationGuardComponent"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("GameMasterComponent")).toBeInTheDocument();
  });

  test("falls back to auth flow when noauth data is missing but query is not loading", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: { api: "http://localhost:3000", ws: "ws://localhost:3000" },
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({
      data: {
        domain: "example.auth0.com",
        clientId: "client-id",
        authorizationParams: {
          audience: "audience",
          redirect_uri: "http://localhost",
        },
      },
    });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isUninitialized: false,
    });

    render(<EnvConfigGuardComponent />);

    expect(screen.getByTestId("Auth0Provider")).toBeInTheDocument();
    expect(
      screen.getByTestId("AuthenticationGuardComponent"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("GameMasterComponent")).toBeInTheDocument();
  });
});
