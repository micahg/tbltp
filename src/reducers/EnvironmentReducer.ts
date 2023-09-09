import { PayloadAction } from "@reduxjs/toolkit";
import { AuthState } from "../utils/auth";
import { Auth0Client } from "@auth0/auth0-spa-js";

export type EnvironmentReducerState = {
  readonly api: string | undefined;
  readonly ws: string | undefined;
  readonly client: Auth0Client | undefined
  /**
   * undefined => do not know yet - auth not attempted
   * false => auth failed
   * true => auth succeeded
   */
  readonly auth: boolean | undefined;
  readonly noauth: boolean; // is authorization disabled
  readonly deviceCode?: any;
  readonly deviceCodeToken?: string;
};

const initialState: EnvironmentReducerState = {
  api: undefined,
  ws: undefined,
  client: undefined,
  auth: undefined,
  noauth: false
}

export const EnvironmentReducer = (state = initialState, action: PayloadAction) => {
	switch(action.type) {
		case 'environment/config': {
			if (action.payload != null && ('data' in action.payload)) {
				if ('API_URL' in action.payload['data'] && 'WS_URL' in action.payload['data']) {
					return {...state, api: action.payload['data']['API_URL'], ws: action.payload['data']['WS_URL']}
				} else {
          console.error(`environment/config payload missing API_URL or WS_URL`);
        }
			}
			return state;
		}
    case 'environment/authconfig': {
      if (action.payload === null || action.payload === undefined) return state;
      const authState: AuthState = (action.payload as unknown) as AuthState;
      return {...state, client: authState.client, noauth: authState.noauth};
    }
    case 'environment/authenticate': {
      if (action.payload === null || action.payload === undefined) return state;
      const authState: AuthState = (action.payload as unknown) as AuthState;
      return {...state, auth: authState.auth, client: authState.client, noauth: authState.noauth};
    }
    case 'environment/devicecode': {
      return {...state, deviceCode: action.payload};
    }
    case 'environment/devicecodepoll': {
      if (action.payload === undefined || action.payload === null) return state;
      const authResult: any = (action.payload as unknown) as any;
      if (!authResult.hasOwnProperty('access_token')) return state;
      return {...state, auth: true, deviceCode: undefined, deviceCodeToken: authResult.access_token};
    }
		default:
			return state;
	}
}