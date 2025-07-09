import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  authenticated?: boolean;
  token?: string;
  authenticationDisabled?: boolean;
}

export const authSlice = createSlice({
  name: "auth",
  initialState: { authenticated: false } as AuthState,
  reducers: {
    setAuthenticated(state, action: PayloadAction<boolean>) {
      state.authenticated = action.payload;
    },
    setAuthenticationDisabled(state, action: PayloadAction<boolean>) {
      state.authenticationDisabled = action.payload;
    },
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
  },
});

export const { setAuthenticated, setAuthenticationDisabled } =
  authSlice.actions;
