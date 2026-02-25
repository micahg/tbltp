import { combineReducers } from "redux";
import { ContentReducer } from "./ContentReducer";
import { environmentApi } from "../api/environment";
import { deviceCodeApi } from "../api/devicecode";
import { RateLimitReducer } from "../slices/rateLimitSlice";

export const AppReducer = combineReducers({
  [environmentApi.reducerPath]: environmentApi.reducer,
  [deviceCodeApi.reducerPath]: deviceCodeApi.reducer,
  rateLimit: RateLimitReducer,
  content: ContentReducer,
});

export type AppReducerState = ReturnType<typeof AppReducer>;
