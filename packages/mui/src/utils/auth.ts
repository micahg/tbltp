import { Auth0Client, createAuth0Client } from "@auth0/auth0-spa-js";
import { AnyAction, Dispatch, MiddlewareAPI } from "@reduxjs/toolkit";
import axios from "axios";
import { AppReducerState } from "../reducers/AppReducer";
import { AuthConfig } from "../reducers/EnvironmentReducer";

/**
 * Authorization state
 */
export interface AuthState {
  // auth client if auth already done
  client?: Auth0Client;
  // flag indicating if authorization is complete
  auth: boolean;
  // flag indicating if authorization explicitly disabled
  noauth?: boolean;
  config?: unknown;
}

/**
 * Step 1 - get your authentication configuration. Remember, its up to the
 * middleware to set this. If you come back here hopefully you read this and
 * aren't tempted (again) to try to set the state from here.
 * @param store
 * @param next
 * @returns
 */
export function getAuthConfig(
  store: MiddlewareAPI<Dispatch<AnyAction>>,
): Promise<AuthState | AuthConfig> {
  return new Promise((resolve, reject) => {
    // ensure we have an authorization state
    const authConfig = store.getState().environment.authConfig;
    if (authConfig !== undefined) return resolve(authConfig); // AuthConfig

    // get the client auth.json and hte server noauth setting. If the server is
    // running in auth disabled mode, /noauth will return {"noauth": true}
    // indicating that it wont even look at the Authorization header.
    const noauthUrl = `${store.getState().environment.api}/noauth`;
    Promise.all([axios.get("/auth.json"), axios.get(noauthUrl)])
      .then(([auth, noauth]) => {
        // combine the auth config into a single state
        const data: AuthState = {
          auth: false,
          noauth: noauth.data.noauth,
          config: auth.data,
        };
        return resolve(data); // AuthState
      })
      .catch((err) => reject(err));
  });
}

/**
 * Step 2 - create an authentication client.
 * @param data
 * @returns
 */
export function getAuthClient(
  store: MiddlewareAPI<Dispatch<AnyAction>>,
): Promise<Auth0Client> {
  const env = store.getState().environment;
  if (env.authClient) return Promise.resolve(env.authClient);

  return new Promise((resolve, reject) => {
    // if (data.noauth) reject('noauth');
    createAuth0Client(env.authConfig)
      .then((client) => resolve(client))
      .catch((reason) => reject(reason));
  });
}

export function getAuthState(client: Auth0Client): Promise<AuthState> {
  return new Promise((resolve, reject) => {
    client.isAuthenticated().then((authn) => {
      const query = window.location.search;

      // if we're already authenticated we can just go get a token
      if (authn) return resolve({ client: client, auth: true });

      // if we have a auth code callback handle it
      if (query.includes("code=") && query.includes("state=")) {
        return client
          .handleRedirectCallback(window.location.href)
          .then(() => {
            const href = window.location.href.split("?")[0];
            window.history.replaceState({}, document.title, href);
            resolve({ client: client, auth: true });
          })
          .catch((reason) => reject(reason));
      }

      // force redirect to log in
      const options = {
        authorizationParams: { redirect_uri: window.location.href },
      };
      return client
        .loginWithRedirect(options)
        .then(() => resolve({ client: client, auth: false }))
        .catch((reason) => reject(reason));
    });
  });
}

/**
 * Step 4 - profit!
 * @param client
 * @returns
 */
export function getToken(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<AnyAction>, unknown>,
  headers?: { [key: string]: string },
): Promise<{ [key: string]: string }> {
  const res = headers || {};

  if (state.environment.noauth) {
    const value = "NOAUTH";
    res["Authorization"] = `Bearer ${value}`;
    store.dispatch({ type: "environment/bearer", payload: value });
    return Promise.resolve(res);
  }

  const client = state.environment.authClient;

  if (!client) return Promise.reject("No auth0 client");

  return new Promise((resolve, reject) => {
    client
      .getTokenSilently()
      .then((value) => {
        store.dispatch({ type: "environment/bearer", payload: value });
        res["Authorization"] = `Bearer ${value}`;
        resolve(res);
      })
      .catch((err) => reject(err));
  });
}

export function getDeviceCode(data: AuthConfig) {
  console.log(data);
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
