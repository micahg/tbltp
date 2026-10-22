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

jest.mock("../EnvLoadingComponent/EnvLoadingComponent.lazy", () => {
  const MockEnvLoadingComponent = () => (
    <div>Loading environment configuration...</div>
  );
  MockEnvLoadingComponent.displayName = "MockEnvLoadingComponent";
  return MockEnvLoadingComponent;
});

jest.mock("../GameMasterComponent/GameMasterComponent.lazy", () => {
  const MockGameMasterComponent = () => (
    <div data-testid="GameMasterComponent" />
  );
  MockGameMasterComponent.displayName = "MockGameMasterComponent";
  return MockGameMasterComponent;
});

jest.mock(
  "../AuthenticationGuardComponent/AuthenticationGuardComponent.lazy",
  () => {
    const MockAuthenticationGuardComponent = ({
      children,
    }: {
      children: React.ReactNode;
    }) => <div data-testid="AuthenticationGuardComponent">{children}</div>;
    MockAuthenticationGuardComponent.displayName =
      "MockAuthenticationGuardComponent";
    return MockAuthenticationGuardComponent;
  },
);

jest.mock("@auth0/auth0-react", () => {
  const actualReact = jest.requireActual("react");
  return {
    Auth0Provider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="Auth0Provider">{children}</div>
    ),
    Auth0Context: actualReact.createContext(undefined),
    initialContext: {},
  };
});

const mockedUseGetEnvironmentConfigQuery =
  useGetEnvironmentConfigQuery as jest.Mock;
const mockedUseGetAuthConfigQuery = useGetAuthConfigQuery as jest.Mock;
const mockedUseGetNoAuthConfigQuery = useGetNoAuthConfigQuery as jest.Mock;

const environmentConfig = {
  api: "http://localhost:3000",
  ws: "ws://localhost:3000",
};

const authConfig = {
  domain: "example.auth0.com",
  clientId: "client-id",
  authorizationParams: {
    audience: "audience",
    redirect_uri: "http://localhost",
  },
};

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

    expect(
      screen.getByText("Loading environment configuration..."),
    ).toBeInTheDocument();
    expect(mockedUseGetNoAuthConfigQuery).toHaveBeenCalledWith(undefined, {
      skip: true,
    });
  });

  test("shows loading while noauth config is unavailable", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: environmentConfig,
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
      screen.getByText("Loading environment configuration..."),
    ).toBeInTheDocument();
    expect(mockedUseGetNoAuthConfigQuery).toHaveBeenCalledWith(undefined, {
      skip: false,
    });
  });

  test("renders game master directly when noauth is enabled", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: environmentConfig,
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
      data: environmentConfig,
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({ data: undefined });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: { noauth: false },
      isLoading: false,
      isFetching: false,
      isUninitialized: false,
    });

    render(<EnvConfigGuardComponent />);

    expect(
      screen.getByText("Loading environment configuration..."),
    ).toBeInTheDocument();
  });

  test("renders auth wrapper and game master when auth config is present", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: environmentConfig,
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({ data: authConfig });
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

  test("shows loading when noauth data is missing", () => {
    mockedUseGetEnvironmentConfigQuery.mockReturnValue({
      data: environmentConfig,
    });
    mockedUseGetAuthConfigQuery.mockReturnValue({ data: authConfig });
    mockedUseGetNoAuthConfigQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isUninitialized: false,
    });

    render(<EnvConfigGuardComponent />);

    expect(
      screen.getByText("Loading environment configuration..."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("Auth0Provider")).not.toBeInTheDocument();
  });
});
