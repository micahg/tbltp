import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AppReducer } from "./reducers/AppReducer";
import { EnvironmentMiddleware } from "./middleware/EnvironmentMiddleware";
import { ContentMiddleware } from "./middleware/ContentMiddleware";
import LandingComponent from "./components/LandingComponent/LandingComponent.lazy";
import RemoteDisplayComponent from "./components/RemoteDisplayComponent/RemoteDisplayComponent.lazy";
import GameMasterComponent from "./components/GameMasterComponent/GameMasterComponent.lazy";
import DeviceCodeComponent from "./components/DeviceCodeComponent/DeviceCodeComponent.lazy";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import UnavailableComponent from "./components/UnavailableComponent/UnavailableComponent";

const routes = [];
routes.push({ path: "/", element: <LandingComponent />, errorElement: null });
routes.push({
  path: "/display",
  element: <RemoteDisplayComponent />,
  errorElement: <UnavailableComponent />,
});
routes.push({
  path: "/edit",
  element: <GameMasterComponent />,
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

const store = configureStore({
  reducer: AppReducer,
  middleware: [EnvironmentMiddleware, ContentMiddleware],
});

store.dispatch({ type: "environment/config", payload: undefined });

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
