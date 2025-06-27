/*********************
 * YOU ARE NOT DONE UNTIL YOU FIX NOAUTH
 * IT WILL BE BROKEN NOW
 */
import { Auth0Client, createAuth0Client } from "@auth0/auth0-spa-js";
import { UnknownAction, Dispatch, MiddlewareAPI } from "@reduxjs/toolkit";
import axios from "axios";
import { AppReducerState } from "../reducers/AppReducer";
import { AuthConfig, AuthError } from "../reducers/EnvironmentReducer";

/**
 * Authorization state
 */
export interface AuthState {
  // auth client if auth already done
  client?: Auth0Client; // TODO REMOVE THIS
  // flag indicating if authorization is complete
  auth: boolean;
  // flag indicating if authorization explicitly disabled
  noauth?: boolean;
  config?: AuthConfig;
}

const AUTH_ERRORS: { [key: string]: string } = {
  access_denied: "Access Denied",
};

/**
 * Step 1 - get your authentication configuration. Remember, its up to the
 * middleware to set this. If you come back here hopefully you read this and
 * aren't tempted (again) to try to set the state from here.
 * @param store
 * @param next
 * @returns
 */
export function getAuthConfig(
  store: MiddlewareAPI<Dispatch<UnknownAction>>,
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
export async function getAuthClient(
  store: MiddlewareAPI<Dispatch<UnknownAction>>,
): Promise<Auth0Client> {
  const env = store.getState().environment;
  // if (env.authClient) return Promise.resolve(env.authClient);
  return createAuth0Client(env.authConfig);

  // return new Promise((resolve, reject) => {
  //   // if (data.noauth) reject('noauth');
  //   createAuth0Client(env.authConfig)
  //     .then((client) => resolve(client))
  //     .catch((reason) => reject(reason));
  // });
}

function removeUrlQuery() {
  const href = window.location.href.split("?")[0];
  window.history.replaceState({}, document.title, href);
}

export async function getAuthState(client: Auth0Client): Promise<AuthState> {
  const authn = await client.isAuthenticated();

  // If already authenticated, resolve with the client and auth state
  if (authn) {
    return { client, auth: true };
  }

  // Handle authentication errors or authorization code callbacks
  const searchParams = new URLSearchParams(window.location.search);

  if (searchParams.get("error")) {
    removeUrlQuery();
    const err = searchParams.get("error");
    const res: AuthError = {
      error: err ? AUTH_ERRORS[err] : err,
      reason: searchParams.get("error_description"),
    };
    throw res;
  }

  if (searchParams.get("code") && searchParams.get("state")) {
    await client.handleRedirectCallback(window.location.href);
    removeUrlQuery();
    return { client, auth: true };
  }

  // Force redirect to log in
  const options = {
    authorizationParams: { redirect_uri: window.location.href },
  };

  await client.loginWithRedirect(options);
  return { client, auth: false };
}

/**
 * Step 4 - profit! TODO DELETE THIS (use the other one instead)
 * @param client
 * @returns
 */
export async function getToken(
  state: AppReducerState,
  store: MiddlewareAPI<Dispatch<UnknownAction>, unknown>,
  headers?: { [key: string]: string },
): Promise<{ [key: string]: string }> {
  const res = headers || {};

  if (state.environment.noauth) {
    const value = "NOAUTH";
    res["Authorization"] = `Bearer ${value}`;
    store.dispatch({ type: "environment/bearer", payload: value });
    return res;
  }

  // const client = state.environment.authClient;

  // if (!client) throw new Error("No auth0 client");

  // const newToken = await client.getTokenSilently();
  // if (state.environment.bearer !== newToken) {
  //   store.dispatch({ type: "environment/bearer", payload: newToken });
  // }
  const token = state.environment.bearer;
  if (!token) throw new Error("No auth0 token");

  res["Authorization"] = `Bearer ${token}`;
  return res;
}

/**
 * We aren't actually caching anything here!
 */
export function getAndCacheToken(
  state: AppReducerState,
  dispatch: Dispatch,
  headers?: { [key: string]: string },
): { [key: string]: string } {
  const res = headers || {};

  if (state.environment.noauth) {
    const value = "NOAUTH";
    res["Authorization"] = `Bearer ${value}`;
    dispatch({ type: "environment/bearer", payload: value });
    return res;
  }

  const token = state.environment.bearer;
  if (!token) throw new Error("No auth0 token");

  res["Authorization"] = `Bearer ${token}`;
  return res;
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

export function pollDeviceCode(store: MiddlewareAPI<Dispatch<UnknownAction>>) {
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
