// Or from '@reduxjs/toolkit/query/react'
import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
  //   type BaseQueryFn,
} from "@reduxjs/toolkit/query/react";
import { AppReducerState } from "../reducers/AppReducer";

type EnvironmentConfig = {
  api: string;
  ws: string;
};

/**
 * Right now this is missing the following data (that probably should go elsewhere):
 *
 * - auth: true if we are authenticated:
 *    - undefined to start
 *    - false after config is pulled
 *    - true once authorized.
 * - noauth: true if authentication is explicitly disabled.
 *
 * Once the state settles (auth, noauth, auth0 config), we setup the Auth0Client,
 * which we configure and store as state (see "environment/authclient").
 *
 * Then, with a real value in `auth`, we can start the authentication flow.
 *
 * - RemoteDisplayComponent will navigates to /device, which calls "environment/devicecode"
 *   and then starts polling for authentication to finish.
 * - GameMasterComponent will navigate to /edit, which calls "environment/authenticate"
 *   and then starts polling for authentication to finish.
 *
 * With the client in place, and calls into the middleware from components, we perform the
 * redirects/auth flow using the auth0 client, and eventually, configure the client with the
 * state (pulled from the URL) so we can get a token.
 *
 * The important bit is in that getAuthState call - it runs after we pull environment config.
 * If we are on a fresh load, it redirects to the auth flow. If we are coming back from a
 * redirect, it initializes the client with the state from the URL.
 *
 * And this is the redux problem ... its nice to have the client in state, ready for use whenever,
 * but redux wont accept a non-serializable value in state. What are we to do?
 *
 * What is a better design? A new middleware/reducer authentication? This feels like a good
 * use of a slice and a utility lib. Maybe the utility lib can singleton the client and our
 * state can just track the actual state.
 *
 *
 *
 * STEPS:
 * - slice that just contains noauth/auth/whatever other state we need
 * - refactor GameMasterComponent to use slice for auth state
 * - comment out the call to "environment/config" from index.tsx (so we know we're doing the auth)
 * - start building out the auth flow... seems like thunk makes most sense.
 * - repeat for RemoteDisplayComponent
 *
 */
type AuthConfig = {
  domain: string;
  clientId: string;
  authorizationParams: {
    audience: string;
    redirect_url: string;
  };
};

// Custom base query that chooses baseUrl based on endpoint
const customBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Determine base URL based on endpoint
  let baseUrl = "/"; // default

  const url = typeof args === "string" ? args : args.url;

  if (!url.endsWith(".json")) {
    const envConfigResult =
      environmentApi.endpoints.getEnvironmentConfig.select()(
        api.getState() as AppReducerState,
      );

    const cfg = envConfigResult.data;
    if (!cfg) {
      throw new Error("Environment not initialized in state");
    }

    baseUrl = cfg.api;
  }

  const baseQuery = fetchBaseQuery({ baseUrl });
  return baseQuery(args, api, extraOptions);
};

export const environmentApi = createApi({
  // baseQuery: fetchBaseQuery({ baseUrl: "/" }),
  baseQuery: customBaseQuery,

  tagTypes: ["Environment"],
  endpoints: (build) => ({
    getEnvironmentConfig: build.query<EnvironmentConfig, void>({
      query: () => ({ url: `/env.json` }),
      // Pick out data and prevent nested properties in a hook or selector
      transformResponse: (response: { API_URL: string; WS_URL: string }) => {
        const cfg: EnvironmentConfig = {
          api: "",
          ws: "",
        };

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
        const infWSUrl = `ws://${window.location.hostname}:${apiPort}`;
        const localhost = window.location.hostname !== "localhost";

        cfg.api =
          response.API_URL === "http://localhost:3000" && !localhost
            ? (cfg.api = infApiUrl)
            : response.API_URL;

        // same goes for webservices - as above so below
        cfg.ws =
          response.WS_URL === "ws://localhost:3000/" && !localhost
            ? (cfg.ws = infWSUrl)
            : response.WS_URL;

        return cfg;
      },
    }),
    getAuthenticationConfig: build.query<AuthConfig, void>({
      query: () => ({ url: `/auth.json` }),
    }),
    getAuthenticationDisabled: build.query<boolean, void>({
      query: () => ({ url: `/noauth` }),
      transformResponse: (response: { noauth: boolean }) => {
        return response.noauth;
      },
      transformErrorResponse: (response, meta) => {
        // at this point, we are toast (in theory our first call has failed)
        const details = {
          name: "getAuthenticationDisabled",
          response,
          meta,
        };
        const b64err = window.btoa(JSON.stringify(details));
        window.location.href = `/unavailable?error=${b64err}`;
        return response;
      },
    }),
  }),
});

export const {
  useGetEnvironmentConfigQuery,
  useGetAuthenticationDisabledQuery,
} = environmentApi;
