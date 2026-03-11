import { combineReducers } from "redux";
import { environmentApi } from "../api/environment";
import { deviceCodeApi } from "../api/devicecode";
import { sceneApi } from "../api/scene";
import { tableStateApi } from "../api/tableState";
import { assetApi } from "../api/asset";
import { tokenApi } from "../api/token";
import { sceneTokenApi } from "../api/scenetoken";
import { RateLimitReducer } from "../slices/rateLimitSlice";
import { EditorUiReducer } from "../slices/editorUiSlice";

export const AppReducer = combineReducers({
  [environmentApi.reducerPath]: environmentApi.reducer,
  [deviceCodeApi.reducerPath]: deviceCodeApi.reducer,
  [sceneApi.reducerPath]: sceneApi.reducer,
  [tableStateApi.reducerPath]: tableStateApi.reducer,
  [assetApi.reducerPath]: assetApi.reducer,
  [tokenApi.reducerPath]: tokenApi.reducer,
  [sceneTokenApi.reducerPath]: sceneTokenApi.reducer,
  rateLimit: RateLimitReducer,
  editorUi: EditorUiReducer,
});

export type AppReducerState = ReturnType<typeof AppReducer>;
