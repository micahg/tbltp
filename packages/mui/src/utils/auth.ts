import { Auth0Client, createAuth0Client } from "@auth0/auth0-spa-js";
import { AnyAction, Dispatch, MiddlewareAPI } from "@reduxjs/toolkit";
import axios from "axios";
import { AuthConfig } from "../reducers/EnvironmentReducer";

const AUTH_ERRORS: { [key: string]: string } = {
  access_denied: "Access Denied",
};

/**
 * Step 2 - create an authentication client.
 * @param data
 * @returns
 */
export function getAuthClient(
  store: MiddlewareAPI<Dispatch<AnyAction>>,
): Promise<Auth0Client> {
  // TODO GET RID OF THIS
  const env = store.getState().environment;
  if (env.authClient) return Promise.resolve(env.authClient);

  return new Promise((resolve, reject) => {
    // if (data.noauth) reject('noauth');
    createAuth0Client(env.authConfig)
      .then((client) => resolve(client))
      .catch((reason) => reject(reason));
  });
}

export function getDeviceCode(data: AuthConfig) {
  return new Promise((resolve, reject) => {
    const params: URLSearchParams = new URLSearchParams({
      client_id: data.clientId,
      audience: data.authorizationParams.audience,
    });
    //https://auth0.com/docs/get-started/authentication-and-authorization-flow/call-your-api-using-the-device-authorization-flow#device-code-response
    axios
      .post(`https://${data.domain}/oauth/device/code`, params)
      .then((resp) =>
        resolve({
          ...resp.data,
          domain: data.domain,
          client_id: data.clientId,
        }),
      )
      .catch((err) => reject(err));
  });
}

export function pollDeviceCode(store: MiddlewareAPI<Dispatch<AnyAction>>) {
  if (store.getState().environment.noauth)
    return Promise.resolve({ access_token: "NOAUTH" });

  return new Promise((resolve, reject) => {
    const deviceCode = store.getState().environment.deviceCode;
    const params = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode.device_code,
      client_id: deviceCode.client_id,
    });
    const url = `https://${deviceCode.domain}/oauth/token`;
    axios
      .post(url, params)
      .then((resp) => resolve(resp.data))
      .catch((err) =>
        err.response.status === 403 ? resolve({}) : reject(err),
      );
  });
}
