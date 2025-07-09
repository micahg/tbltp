import { configureStore } from "@reduxjs/toolkit";
import { AppReducer } from "./reducers/AppReducer";
import { environmentApi } from "./api/environment";
import { EnvironmentMiddleware } from "./middleware/EnvironmentMiddleware";
import { ContentMiddleware } from "./middleware/ContentMiddleware";
import { auth0Api } from "./api/auth0";

export const store = configureStore({
  reducer: AppReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      auth0Api.middleware,
      environmentApi.middleware,
      EnvironmentMiddleware,
      ContentMiddleware,
    ),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
