import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { environmentApi } from "./environment";
import { AppReducerState } from "../reducers/AppReducer";
import { authSlice } from "../slices/auth";

const customBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const authConfigResult =
    environmentApi.endpoints.getAuthenticationConfig.select()(
      api.getState() as AppReducerState,
    );

  const cfg = authConfigResult.data;
  if (!cfg) {
    throw new Error("Environment not initialized in state");
  }

  // change this to correct domain
  const baseUrl = `https://${cfg.domain}`;

  const baseQuery = fetchBaseQuery({ baseUrl });
  return baseQuery(args, api, extraOptions);
};

type Auth0DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  verification_uri_complete: string;
};

type Auth0DeviceCodeResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

// TODO we could move the call to authSlice.actions.setToken(token) here.
// auth0Singleton.client.getTokenSilently() here if we wanted to use a queryFn.
// Look into that getTokenSilently to see if there is any worth in using it beyond
// storing the original token returned to us.
export const auth0Api = createApi({
  reducerPath: "auth0Api",
  baseQuery: customBaseQuery,
  endpoints: (builder) => ({
    getDeviceCode: builder.query<Auth0DeviceCode, void>({
      queryFn: async (_arg, api, _extraOptions, baseQuery) => {
        const state = api.getState() as AppReducerState;

        // Pull parameters from state
        const authConfig =
          environmentApi.endpoints.getAuthenticationConfig.select()(
            state,
          )?.data;

        if (!authConfig) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "No authentication configuration available",
            } as FetchBaseQueryError,
          };
        }

        const result = await baseQuery({
          url: "/oauth/device/code",
          method: "POST",
          body: new URLSearchParams({
            client_id: authConfig.clientId,
            audience: authConfig.authorizationParams.audience,
          }),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        return {
          data: result.data as Auth0DeviceCode,
          meta: result.meta,
        };
        // return result;
      },
    }),
    pollDeviceCode: builder.query<Auth0DeviceCodeResponse, string>({
      queryFn: async (deviceCode, api, _extraOptions, baseQuery) => {
        const state = api.getState() as AppReducerState;

        // Pull parameters from state
        const authConfig =
          environmentApi.endpoints.getAuthenticationConfig.select()(
            state,
          )?.data;

        if (!authConfig) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "No authentication configuration available",
            } as FetchBaseQueryError,
          };
        }

        const result = await baseQuery({
          url: "/oauth/token",
          method: "POST",
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: deviceCode,
            client_id: authConfig.clientId,
          }),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        if (result.data) {
          const data = result.data as Auth0DeviceCodeResponse;
          api.dispatch(authSlice.actions.setToken(data.access_token));
          api.dispatch(authSlice.actions.setAuthenticated(true));
          return { data, meta: result.meta };
        }

        return { error: result.error as FetchBaseQueryError };
      },
    }),
  }),
});

export const { useGetDeviceCodeQuery, useLazyPollDeviceCodeQuery } = auth0Api;

// can i use the auth0Singleton.client to get the device code? probably!
// queryFn(_arg, api /*extraOptions, baseQuery*/) {
//   const state = api.getState() as AppReducerState;

//   // Pull parameters from state
//   const authConfig =
//     environmentApi.endpoints.getAuthenticationConfig.select()(
//       state,
//     )?.data;

//   if (!authConfig) {
//     return {
//       error: {
//         status: "CUSTOM_ERROR",
//         error: "No authentication configuration available",
//       } as FetchBaseQueryError,
//     };
//   }

//   const client = authClientSingleton.getClient();
//   if (!client) {
//     return {
//       error: {
//         status: "CUSTOM_ERROR",
//         error: "Auth client not initialized",
//       } as FetchBaseQueryError,
//     };
//   }

//   // client.
//   return { data: "there" };

//   // const params: URLSearchParams = new URLSearchParams({
//   //   client_id: data.clientId,
//   //   audience: data.authorizationParams.audience,
//   // });
//   // return {
//   //   url: "/oauth/device/code",
//   //   method: "POST",
//   //   body: data,
//   // };
// },
