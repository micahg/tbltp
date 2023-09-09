import { Auth0Client, createAuth0Client } from "@auth0/auth0-spa-js";
import { AnyAction, Dispatch, MiddlewareAPI } from "@reduxjs/toolkit";
import axios from "axios";
import { AppReducerState } from "../reducers/AppReducer";

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
}

/**
 * Step 1 - get your authentication configuraiton
 * @param store 
 * @param next 
 * @returns 
 */
export function getAuthConfig(store: MiddlewareAPI<Dispatch<AnyAction>>): Promise<any> {
  return new Promise((resolve, reject) => {

    // ensure we have an authorization state
        const auth = store.getState().auth;
    if (auth !== undefined) return resolve(auth);

    // get the client auth.json and hte server noauth setting. If the server is
    // running in auth disabled mode, /noauth will return {"noauth": true}
    // indicating that it wont even look at the Authorization header.
    const noauthUrl = `${store.getState().environment.api}/noauth`;
    Promise.all([axios.get("/auth.json"), axios.get(noauthUrl)]).then(([auth, noauth]) => {
      // combine the auth config into a single state
      const data = auth.data;
      // if (noauth.data.noauth) return reject("noauth");
      data.noauth = noauth.data.noauth;
      data.auth = false;
      return resolve(data);
    }).catch(err => reject(err));
  });
}

/**
 * Step 2 - create an authentication client.
 * @param data 
 * @returns 
 */
export function getAuthClient(data: any): Promise<Auth0Client> {
  return new Promise((resolve, reject) => {
    if (data.noauth) reject('noauth');
    createAuth0Client(data).then(client => resolve(client))
      .catch(reason => reject(reason));
  })
}

export function getAuthState(client: Auth0Client): Promise<AuthState> {
  return new Promise((resolve, reject) => {
    client.isAuthenticated().then(authn => {
      const query = window.location.search;

      // if we're alread authenticated we can just go get a token
      if (authn) return resolve({client: client, auth: true});

      // if we have a auth code callback handle it
      if (query.includes("code=") && query.includes("state=")) {
        return client.handleRedirectCallback(window.location.href)
          .then(() => {
            const href = window.location.href.split('?')[0];
            window.history.replaceState({}, document.title, href);
            resolve({client: client, auth: true})
          })
          .catch(reason => reject(reason));
      }

      // force redirect to log in
      const options = {authorizationParams: {redirect_uri: window.location.href}};
      return client.loginWithRedirect(options).then(() => resolve({client: client, auth: false}))
        .catch(reason => reject(reason));
    });
  });
}

/**
 * Step 4 - profit!
 * @param client 
 * @returns 
 */
export function getToken(state: AppReducerState, headers?: any): Promise<any> {
  if (!headers) headers = {};

  if (state.environment.noauth) {
    headers['Authorization'] = `Bearer NOAUTH`;
    return Promise.resolve(headers);
  }

  const client = state.environment.client;
  
  if (!client) return Promise.reject('No auth0 client');

  return new Promise((resolve, reject) => {
    client.getTokenSilently()
      .then(value => {
        headers['Authorization'] = `Bearer ${value}`;
        resolve(headers);
      })
      .catch(err => reject(err));
  });
}

export function getDeviceCode(data: any) {
  return new Promise((resolve, reject) => {
    const params: URLSearchParams = new URLSearchParams({
      'client_id': data.clientId,
      'audience': data.authorizationParams.audience,
    });
    axios.post(`https://${data.domain}/oauth/device/code`, params)
      .then(resp => resolve({...resp.data, domain: data.domain, client_id: data.clientId}))
      .catch(err => reject(err));
  });
}

export function pollDeviceCode(store: MiddlewareAPI<Dispatch<AnyAction>>) {
  return new Promise((resolve, reject) => {
    const deviceCode = store.getState().environment.deviceCode;
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode.device_code,
      client_id: deviceCode.client_id,
    });
    const url: string = `https://${deviceCode.domain}/oauth/token`;
    axios.post(url, params)
      .then(resp => resolve(resp.data))
      .catch(err => err.response.status === 403 ? resolve({}) : reject(err));
  });
}