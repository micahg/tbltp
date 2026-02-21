import { PayloadAction } from "@reduxjs/toolkit";

export interface AuthConfig {
  domain: string;
  clientId: string;
  authorizationParams: {
    audience: string;
    redirect_uri: string;
  };
}

export interface AuthError {
  error: string | null;
  reason: string | null;
}

// https://auth0.com/docs/get-started/authentication-and-authorization-flow/call-your-api-using-the-device-authorization-flow#device-code-response
export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export type EnvironmentReducerState = {
  readonly noauth: boolean; // is authorization disabled
  /**
   * Indicates if auth was attempted. This is here because of react strict mode
   * that renders things twice to mess with your life and elicit your errors.
   */
  readonly authStarted: boolean;
  /**
   * undefined => do not know yet - haven't hit server, auth not attmepted
   * false => not authorized
   * true => auth succeeded
   */
  readonly auth?: boolean;
  readonly authErr?: AuthError;
  readonly authConfig?: AuthConfig;
  readonly deviceCode?: DeviceCode;
  readonly deviceCodeToken?: string;
  readonly ratelimitRemaining: number;
  readonly ratelimit: number;
  readonly ratelimitMax: number;
};

const initialState: EnvironmentReducerState = {
  noauth: false,
  authStarted: false,
  ratelimitRemaining: -1,
  ratelimit: -1,
  ratelimitMax: -1,
};

export const EnvironmentReducer = (
  state = initialState,
  action: PayloadAction,
) => {
  switch (action.type) {
    case "environment/authstarted": {
      if (action.payload === null || action.payload === undefined) return state;
      const started: boolean = action.payload as unknown as boolean;
      return { ...state, authStarted: started };
    }
    case "environment/authfailure": {
      const err = action.payload as unknown as AuthError;
      return { ...state, auth: false, authErr: err };
    }
    case "environment/devicecode": {
      return { ...state, deviceCode: action.payload };
    }
    case "environment/devicecodepoll": {
      if (action.payload === undefined || action.payload === null) return state;
      const authResult: unknown = action.payload;
      if (
        !authResult ||
        typeof authResult !== "object" ||
        !("access_token" in authResult)
      )
        return state;
      return {
        ...state,
        auth: true,
        deviceCode: undefined,
        deviceCodeToken: authResult.access_token,
      };
    }
    case "environment/ratelimit": {
      if (action.payload === null || action.payload === undefined) return state;
      if (!("limit" in action.payload) || !("remaining" in action.payload))
        return state;
      const { limit: l, remaining: r } = action.payload as unknown as {
        limit: number;
        remaining: number;
      };
      const u = l - r;
      const m = Math.max(state.ratelimitMax, u);
      return { ...state, ratelimit: l, ratelimitRemaining: r, ratelimitMax: m };
    }
    default:
      return state;
  }
};
