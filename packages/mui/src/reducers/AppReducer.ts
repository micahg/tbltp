import { combineReducers } from "redux";
import { ContentReducer } from "./ContentReducer";
import { environmentApi } from "../api/environment";
import { authSlice } from "../slices/auth";
import { auth0Api } from "../api/auth0";
import { environmentSlice } from "../slices/environment";

export const AppReducer = combineReducers({
  [environmentApi.reducerPath]: environmentApi.reducer,
  [auth0Api.reducerPath]: auth0Api.reducer,
  auth: authSlice.reducer,
  environment: environmentSlice.reducer,
  content: ContentReducer,
});

export type AppReducerState = ReturnType<typeof AppReducer>;
