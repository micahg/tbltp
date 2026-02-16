import {
  AuthState,
  getAuthClient,
  getAuthConfig,
  getAuthState,
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

    if (typedAction.type === "environment/config") {
      try {
        const envCfg = environmentApi.endpoints.getEnvironmentConfig.select()(
          storeAPI.getState() as never,
        ).data;

        if (!envCfg) {
          const dispatchEnvironmentConfig = storeAPI.dispatch as (
            thunk: ReturnType<
              typeof environmentApi.endpoints.getEnvironmentConfig.initiate
            >,
          ) => Promise<{ error?: unknown }>;

          const envCfgAction = await dispatchEnvironmentConfig(
            environmentApi.endpoints.getEnvironmentConfig.initiate(undefined, {
              subscribe: false,
            }),
          );
          if (envCfgAction.error) throw envCfgAction.error;
        }

        next(action);
        const authCfg = await getAuthConfig(storeAPI);
        next({ type: "environment/authconfig", payload: authCfg });
        const authClient = await getAuthClient(storeAPI);
        next({ type: "environment/authclient", payload: authClient });
      } catch {
        const errPath = "/unavailable";
        if (window.location.pathname === errPath) return;
        const b64err = window.btoa(`Unable to fetch environment configuration`);
        window.location.href = `${errPath}?error=${b64err}`;
      }
    } else if (typedAction.type === "environment/authenticate") {
      if (storeAPI.getState().environment.authStarted) return next(action);
      next({ type: "environment/authstarted", payload: true });

      const authClient = storeAPI.getState().environment.authClient;
      try {
        const state = await getAuthState(authClient);
        if (state) return next({ type: typedAction.type, payload: state });
      } catch (err) {
        if (err === "noauth") {
          console.warn("Authentication explicitly disabled at server");
          const authState: AuthState = { auth: false, noauth: true };
          return next({ type: typedAction.type, payload: authState });
        }
        return next({ type: "environment/authfailure", payload: err });
      }
    } else if (typedAction.type === "environment/logout") {
      getAuthClient(storeAPI)
        .then((client) => client.logout())
        .then(() => console.log("Successfully logged out"))
        .catch((err) =>
          console.error(`UNABLE TO LOG OUT: ${JSON.stringify(err)}`),
        );
    } else if (typedAction.type === "environment/devicecode") {
      if (storeAPI.getState().environment.authStarted) return next(action);
      next({ type: "environment/authstarted", payload: true });

      getAuthConfig(storeAPI)
        .then((data) => getDeviceCode(data as AuthConfig))
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
