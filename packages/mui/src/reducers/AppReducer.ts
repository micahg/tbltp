import { combineReducers } from "redux";
import { ContentReducer } from "./ContentReducer";
import { EnvironmentReducer } from "./EnvironmentReducer";
import { environmentApi } from "../api/environment";

export const AppReducer = combineReducers({
  [environmentApi.reducerPath]: environmentApi.reducer,
  environment: EnvironmentReducer,
  content: ContentReducer,
});

export type AppReducerState = ReturnType<typeof AppReducer>;
