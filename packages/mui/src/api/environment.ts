// Or from '@reduxjs/toolkit/query/react'
import {
  createApi,
  fetchBaseQuery,
  //   type BaseQueryFn,
} from "@reduxjs/toolkit/query/react";

export interface AuthConfig {
  domain: string;
  clientId: string;
  authorizationParams: {
    audience: string;
    redirect_uri: string;
  };
}

type EnvironmentConfig = {
  api: string;
  ws: string;
};

type NoAuthConfig = {
  noauth: boolean;
};

export const environmentApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "/" }),
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
        const isNonLocalhost = window.location.hostname !== "localhost";

        cfg.api =
          response.API_URL === "http://localhost:3000" && isNonLocalhost
            ? (cfg.api = infApiUrl)
            : response.API_URL;

        // same goes for webservices - as above so below
        cfg.ws =
          response.WS_URL === "ws://localhost:3000/" && isNonLocalhost
            ? (cfg.ws = infWSUrl)
            : response.WS_URL;

        return cfg;
      },
    }),
    getAuthConfig: build.query<AuthConfig, void>({
      query: () => ({ url: `/auth.json` }),
    }),
    getNoAuthConfig: build.query<NoAuthConfig, void>({
      async queryFn(_arg, api, _extraOptions, fetchWithBQ) {
        const selectEnvironmentConfig =
          environmentApi.endpoints.getEnvironmentConfig.select();
        const env = selectEnvironmentConfig(
          api.getState() as Parameters<typeof selectEnvironmentConfig>[0],
        ).data;

        if (!env?.api) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Environment API config is not loaded",
            },
          };
        }

        const response = await fetchWithBQ(`${env.api}/noauth`);
        if (response.error) {
          return { error: response.error };
        }

        return { data: response.data as NoAuthConfig };
      },
    }),
  }),
});

export const {
  useGetEnvironmentConfigQuery,
  useGetAuthConfigQuery,
  useGetNoAuthConfigQuery,
} = environmentApi;
