import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { Auth0Provider } from "@auth0/auth0-react";
import { Provider } from "react-redux";
import LandingComponent from "./components/LandingComponent/LandingComponent.lazy";
import RemoteDisplayComponent from "./components/RemoteDisplayComponent/RemoteDisplayComponent.lazy";
import GameMasterComponent from "./components/GameMasterComponent/GameMasterComponent.lazy";
import DeviceCodeComponent from "./components/DeviceCodeComponent/DeviceCodeComponent.lazy";
import AuthTokenBridge from "./components/AuthTokenBridge/AuthTokenBridge";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import UnavailableComponent from "./components/UnavailableComponent/UnavailableComponent";
import { store } from "./store";
import { useGetAuthConfigQuery, useGetNoAuthConfigQuery, useGetEnvironmentConfigQuery} from "./api/environment";

const AuthenticatedGameMasterComponent = () => {
  const { data: environmentConfig } = useGetEnvironmentConfigQuery();
  const { data: authConfig } = useGetAuthConfigQuery();
  
  // skip allows the component to rerender when the useGetEnvironmentConfigQuery state changes.
  // we need the environmentConfig to get the API URL before we can fetch the noauth config,
  // so we skip the noauth query until we have the environmentConfig.
  const { data: noAuthConfig } = useGetNoAuthConfigQuery(undefined, {
    skip: !environmentConfig?.api,
  });

  if (noAuthConfig?.noauth || !authConfig) {
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
