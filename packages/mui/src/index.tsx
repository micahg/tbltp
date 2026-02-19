import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { Auth0Provider } from "@auth0/auth0-react";
import { Provider, useSelector } from "react-redux";
import LandingComponent from "./components/LandingComponent/LandingComponent.lazy";
import RemoteDisplayComponent from "./components/RemoteDisplayComponent/RemoteDisplayComponent.lazy";
import GameMasterComponent from "./components/GameMasterComponent/GameMasterComponent.lazy";
import DeviceCodeComponent from "./components/DeviceCodeComponent/DeviceCodeComponent.lazy";
import AuthTokenBridge from "./components/AuthTokenBridge/AuthTokenBridge";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import UnavailableComponent from "./components/UnavailableComponent/UnavailableComponent";
import { store } from "./store";
import type { RootState } from "./store";
import type { AuthConfig } from "./reducers/EnvironmentReducer";
import { environmentApi } from "./api/environment";

store.dispatch(environmentApi.endpoints.getEnvironmentConfig.initiate());
store.dispatch(environmentApi.endpoints.getAuthConfig.initiate());
store.dispatch(environmentApi.endpoints.getNoAuthConfig.initiate());
store.dispatch({ type: "environment/config", payload: undefined });

const AuthenticatedGameMasterComponent = () => {
  const noauth = useSelector((state: RootState) => state.environment.noauth);
  const authConfig = useSelector(
    (state: RootState) => state.environment.authConfig,
  ) as AuthConfig | undefined;

  if (noauth || !authConfig) {
    return <GameMasterComponent />;
  }

  return (
    <Auth0Provider
      domain={authConfig.domain}
      clientId={authConfig.clientId}
      authorizationParams={authConfig.authorizationParams}
    >
      <AuthTokenBridge />
      <GameMasterComponent />
    </Auth0Provider>
  );
};

const routes = [];
routes.push({ path: "/", element: <LandingComponent />, errorElement: null });
routes.push({
  path: "/display",
  element: <RemoteDisplayComponent />,
  errorElement: <UnavailableComponent />,
});
routes.push({
  path: "/edit",
  element: <AuthenticatedGameMasterComponent />,
  errorElement: <UnavailableComponent />,
});
routes.push({
  path: "/device",
  element: <DeviceCodeComponent />,
  errorElement: <UnavailableComponent />,
});
routes.push({
  path: "/unavailable",
  element: <UnavailableComponent />,
  errorElement: null,
});

const router = createBrowserRouter(routes);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
