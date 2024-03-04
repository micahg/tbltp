import {
  AuthState,
  getAuthClient,
  getAuthConfig,
  getAuthState,
  getDeviceCode,
  pollDeviceCode,
} from "../utils/auth";
import { Middleware } from "redux";
import axios from "axios";
import { AuthConfig, AuthError } from "../reducers/EnvironmentReducer";

export const EnvironmentMiddleware: Middleware =
  (storeAPI) => (next) => async (action) => {
    if (action.type === "environment/config") {
      axios
        .get("/env.json")
        .then((data) => {
          action.payload = data;

          // if we are running on our dev port (i know its angular shut up) then set the API
          // port to 3000. Also this could be more elaborate and just use the API_URL port.
          // Why did we do this? If you're trying to test memory constrainted clients (trying
          // to get chrome on android virtual device to behave like silke), you can hit the
          // localhost:4200 app on 10.0.2.2:4200
          const apiPort =
            window.location.port === "4200" ? "3000" : window.location.port;

          // small hack here for when we're running in combined docker.
          // saas images will have non localhost values returned by through a
          // k8s config map. Otherwise, if we're running on some non-localhost
          // value with our API_URL configured to localhost, just use combined
          // protocol/host/port as the base (for the combined docker image)
          const infApiUrl = `${window.location.protocol}//${window.location.hostname}:${apiPort}`;
          if (
            action.payload.data.API_URL === "http://localhost:3000" &&
            window.location.hostname !== "localhost"
          ) {
            action.payload.data.API_URL = infApiUrl;
          }

          // same goes for webservices - as above so below
          const infWSUrl = `ws://${window.location.hostname}:${apiPort}`;
          if (
            action.payload.data.WS_URL === "ws://localhost:3000/" &&
            window.location.hostname !== "localhost"
          ) {
            action.payload.data.WS_URL = infWSUrl;
          }

          return next(action);
        })
        .then(() => getAuthConfig(storeAPI))
        .then((data) => next({ type: "environment/authconfig", payload: data }))
        .then(() => getAuthClient(storeAPI))
        .then((client) =>
          next({ type: "environment/authclient", payload: client }),
        )
        .catch((reason) => {
          // TODO trigger an error
          console.error(`FAILED TO ENV CONFIG FETCH ${JSON.stringify(reason)}`);
        });
    } else if (action.type === "environment/authenticate") {
      if (storeAPI.getState().environment.authStarted) return next(action);
      next({ type: "environment/authstarted", payload: true });

      const authClient = storeAPI.getState().environment.authClient;
      try {
        const state = await getAuthState(authClient);
        if (state) return next({ type: action.type, payload: state });
      } catch (err) {
        if (err === "noauth") {
          console.warn("Authentication explicitly disabled at server");
          const authState: AuthState = { auth: false, noauth: true };
          return next({ type: action.type, payload: authState });
        }
        return next({ type: "environment/authfailure", payload: err });
      }
    } else if (action.type === "environment/logout") {
      getAuthClient(storeAPI)
        .then((client) => client.logout())
        .then(() => console.log("Successfully logged out"))
        .catch((err) =>
          console.error(`UNABLE TO LOG OUT: ${JSON.stringify(err)}`),
        );
    } else if (action.type === "environment/devicecode") {
      if (storeAPI.getState().environment.authStarted) return next(action);
      next({ type: "environment/authstarted", payload: true });

      getAuthConfig(storeAPI)
        .then((data) => getDeviceCode(data as AuthConfig))
        .then((value) => next({ type: action.type, payload: value }))
        .catch((err) =>
          console.error(
            `Device Code Authentication Failed: ${JSON.stringify(err)}`,
          ),
        );
    } else if (action.type === "environment/devicecodepoll") {
      pollDeviceCode(storeAPI)
        .then((data) => next({ type: action.type, payload: data }))
        .catch((err) =>
          console.error(`Device code fetch failed: ${JSON.stringify(err)}`),
        );
    } else {
      return next(action);
    }
  };
