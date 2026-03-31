import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { AuthConfig } from "./environment";

// https://auth0.com/docs/get-started/authentication-and-authorization-flow/call-your-api-using-the-device-authorization-flow#device-code-response
export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

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

const toCustomError = (error: unknown): DeviceCodeApiError => ({
  status: "CUSTOM_ERROR",
  data: error instanceof Error ? error.message : String(error),
});

const readResponseData = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const postForm = async (
  url: string,
  params: URLSearchParams,
): Promise<{ data?: unknown; error?: DeviceCodeApiError }> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const data = await readResponseData(response);
    if (!response.ok) {
      return {
        error: {
          status: response.status,
          data,
        },
      };
    }

    return { data };
  } catch (error) {
    return { error: toCustomError(error) };
  }
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

        const result = await postForm(url, params);
        if (result.error) return { error: result.error };

        return {
          data: {
            ...(result.data as DeviceCode),
            domain: authConfig.domain,
            client_id: authConfig.clientId,
          },
        };
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

        const result = await postForm(url, params);
        if (result.error?.status === 403) {
          return { data: {} };
        }
        if (result.error) {
          return { error: result.error };
        }

        return { data: result.data as { access_token?: string } };
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
