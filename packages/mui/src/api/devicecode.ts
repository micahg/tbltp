import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import axios from "axios";
import { AuthConfig, DeviceCode } from "../reducers/EnvironmentReducer";

type DeviceCodeApiError = {
  status: number | "CUSTOM_ERROR";
  data: unknown;
};

export type DeviceCodeResult = DeviceCode & {
  domain: string;
  client_id: string;
};

export type DeviceAuthState = {
  authorized: boolean;
  token?: string;
  deviceCode?: DeviceCodeResult;
};

const initialDeviceAuthState: DeviceAuthState = {
  authorized: false,
};

type PollDeviceCodeArgs = {
  noauth: boolean;
  deviceCode?: DeviceCodeResult;
};

export const deviceCodeApi = createApi({
  reducerPath: "deviceCodeApi",
  baseQuery: fakeBaseQuery<DeviceCodeApiError>(),
  endpoints: (build) => ({
    getDeviceAuthState: build.query<DeviceAuthState, void>({
      queryFn: () => ({ data: initialDeviceAuthState }),
      keepUnusedDataFor: 60 * 60 * 24,
    }),
    getDeviceCode: build.mutation<DeviceCodeResult, AuthConfig>({
      async queryFn(authConfig) {
        const params = new URLSearchParams({
          client_id: authConfig.clientId,
          audience: authConfig.authorizationParams.audience,
        });
        const url = `https://${authConfig.domain}/oauth/device/code`;

        try {
          const response = await axios.post(url, params);
          return {
            data: {
              ...response.data,
              domain: authConfig.domain,
              client_id: authConfig.clientId,
            },
          };
        } catch (error) {
          if (axios.isAxiosError(error)) {
            return {
              error: {
                status: error.response?.status ?? "CUSTOM_ERROR",
                data: error.response?.data ?? error.message,
              },
            };
          }
          return { error: { status: "CUSTOM_ERROR", data: String(error) } };
        }
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            deviceCodeApi.util.upsertQueryData(
              "getDeviceAuthState",
              undefined,
              {
                authorized: false,
                token: undefined,
                deviceCode: data,
              },
            ),
          );
        } catch {
          // no-op
        }
      },
    }),
    pollDeviceCode: build.mutation<
      { access_token?: string },
      PollDeviceCodeArgs
    >({
      async queryFn({ noauth, deviceCode }) {
        if (noauth) return { data: { access_token: "NOAUTH" } };
        if (!deviceCode) return { data: {} };

        const params = new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode.device_code,
          client_id: deviceCode.client_id,
        });
        const url = `https://${deviceCode.domain}/oauth/token`;

        try {
          const response = await axios.post(url, params);
          return { data: response.data };
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 403) {
            return { data: {} };
          }

          if (axios.isAxiosError(error)) {
            return {
              error: {
                status: error.response?.status ?? "CUSTOM_ERROR",
                data: error.response?.data ?? error.message,
              },
            };
          }

          return { error: { status: "CUSTOM_ERROR", data: String(error) } };
        }
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data.access_token) return;

          dispatch(
            deviceCodeApi.util.upsertQueryData(
              "getDeviceAuthState",
              undefined,
              {
                authorized: true,
                token: data.access_token,
                deviceCode: undefined,
              },
            ),
          );
        } catch {
          // no-op
        }
      },
    }),
  }),
});

export const {
  useGetDeviceAuthStateQuery,
  useGetDeviceCodeMutation,
  usePollDeviceCodeMutation,
} = deviceCodeApi;
