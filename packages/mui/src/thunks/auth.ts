import { createAsyncThunk } from "@reduxjs/toolkit";
import { AppReducerState } from "../reducers/AppReducer";
import { authClientSingleton } from "../utils/auth0";
import { environmentApi } from "../api/environment";
import { authSlice } from "../slices/auth";

interface AuthResult {
  isAuthenticated: boolean;
  user?: unknown;
}

function removeUrlQuery() {
  const href = window.location.href.split("?")[0];
  window.history.replaceState({}, document.title, href);
}

export const initializeAuth = createAsyncThunk<
  AuthResult,
  void,
  {
    state: AppReducerState;
  }
>("auth/initialize", async (_, { getState, rejectWithValue, dispatch }) => {
  try {
    const state = getState();

    // Check if authentication is disabled -- we want a definite state
    const authDisabled =
      environmentApi.endpoints.getAuthenticationDisabled.select()(state);
    if (authDisabled?.data === undefined || authDisabled?.data === true) {
      return { isAuthenticated: false };
    }

    // Get auth config from RTK Query state
    const authConfigResult =
      environmentApi.endpoints.getAuthenticationConfig.select()(state);

    if (!authConfigResult?.data) {
      // TODO MICAH can we just trigger loading the data here?
      throw new Error("No auth configuration available");
    }

    const authConfig = authConfigResult.data;
    // Initialize singleton client
    const client = authClientSingleton.initialize(authConfig);

    // Handle auth callback if present
    const searchParams = new URLSearchParams(window.location.search);
    const redirectError = searchParams.get("error");
    if (redirectError) {
      removeUrlQuery();
      // TODO might need to redirect to specific error page
      throw new Error("Authentication callback failed", {
        cause: new Error(searchParams.get("error") || "Unknown error"),
      });
    }

    if (searchParams.get("code") && searchParams.get("state")) {
      await client.handleRedirectCallback(window.location.href);
      removeUrlQuery();
      // TODO MICAH what we want is to update the state at this point....
      // return { isAuthenticated: true };
    }

    // If not authenticated and no callback, initiate login
    const isAuthenticated = await client.isAuthenticated();
    if (!isAuthenticated) {
      await client.loginWithRedirect();
      return { isAuthenticated: false }; // This won't actually return due to redirect
    }

    // Get user info if authenticated
    const user = await client.getUser();
    dispatch(authSlice.actions.setAuthenticated(true));
    return { isAuthenticated: true, user };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Auth initialization failed",
    );
  }
});

export const logout = createAsyncThunk("auth0/logout", async () => {
  const client = authClientSingleton.getClient();
  if (client) {
    await client.logout({ logoutParams: { returnTo: window.location.origin } });
  }
  authClientSingleton.reset();
});

export const getAccessToken = createAsyncThunk<string, void>(
  "auth0/getAccessToken",
  async (_, { rejectWithValue }) => {
    try {
      const client = authClientSingleton.getClient();
      if (!client) {
        throw new Error("Auth client not initialized");
      }

      const token = await client.getTokenSilently();
      return token;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to get token",
      );
    }
  },
);
