import { combineReducers } from "redux";
import { ContentReducer } from "./ContentReducer";
import { environmentApi } from "../api/environment";
import { deviceCodeApi } from "../api/devicecode";
import { sceneApi } from "../api/scene";
import { tableStateApi } from "../api/tableState";
import { assetApi } from "../api/asset";
import { RateLimitReducer } from "../slices/rateLimitSlice";
import { EditorUiReducer } from "../slices/editorUiSlice";

export const AppReducer = combineReducers({
  [environmentApi.reducerPath]: environmentApi.reducer,
  [deviceCodeApi.reducerPath]: deviceCodeApi.reducer,
  [sceneApi.reducerPath]: sceneApi.reducer,
  [tableStateApi.reducerPath]: tableStateApi.reducer,
  [assetApi.reducerPath]: assetApi.reducer,
  rateLimit: RateLimitReducer,
  editorUi: EditorUiReducer,
  content: ContentReducer,
});

export type AppReducerState = ReturnType<typeof AppReducer>;
