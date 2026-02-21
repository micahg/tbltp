import {
  getDeviceCode,
  pollDeviceCode,
} from "../utils/auth";
import { Middleware } from "redux";
import { AuthConfig } from "../reducers/EnvironmentReducer";
import { environmentApi } from "../api/environment";

export const EnvironmentMiddleware: Middleware =
  (storeAPI) => (next) => async (action) => {
    if (!action || typeof action !== "object" || !("type" in action)) {
      return next(action);
    }

    const typedAction = action as { type: string; payload?: unknown };

    if (typedAction.type === "environment/devicecode") {
      const started = storeAPI.getState().environment.authStarted;
      if (started) return next(action);
      next({ type: "environment/authstarted", payload: true });

      const cfg = environmentApi.endpoints.getAuthConfig.select()(
        storeAPI.getState() as never,
      ).data;

      getDeviceCode(cfg as AuthConfig)
        .then((value) => next({ type: typedAction.type, payload: value }))
        .catch((err) =>
          console.error(
            `Device Code Authentication Failed: ${JSON.stringify(err)}`,
          ),
        );
    } else if (typedAction.type === "environment/devicecodepoll") {
      pollDeviceCode(storeAPI)
        .then((data) => next({ type: typedAction.type, payload: data }))
        .catch((err) =>
          console.error(`Device code fetch failed: ${JSON.stringify(err)}`),
        );
    } else {
      return next(action);
    }
  };
