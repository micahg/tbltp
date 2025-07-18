// Or from '@reduxjs/toolkit/query/react'
import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { AppReducerState } from "../reducers/AppReducer";

type EnvironmentConfig = {
  api: string;
  ws: string;
};

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
