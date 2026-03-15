import { configureStore } from "@reduxjs/toolkit";
import { AppReducer } from "./reducers/AppReducer";
import { environmentApi } from "./api/environment";
import { deviceCodeApi } from "./api/devicecode";
import { sceneApi } from "./api/scene";
import { tableStateApi } from "./api/tableState";
import { assetApi } from "./api/asset";
import { tokenApi } from "./api/token";
import { sceneTokenApi } from "./api/scenetoken";

export const store = configureStore({
  reducer: AppReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      environmentApi.middleware,
      deviceCodeApi.middleware,
      sceneApi.middleware,
      tableStateApi.middleware,
      assetApi.middleware,
      tokenApi.middleware,
      sceneTokenApi.middleware,
    ),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
