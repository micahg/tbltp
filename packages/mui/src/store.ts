import { configureStore } from "@reduxjs/toolkit";
import { AppReducer } from "./reducers/AppReducer";
import { environmentApi } from "./api/environment";
import { EnvironmentMiddleware } from "./middleware/EnvironmentMiddleware";
import { ContentMiddleware } from "./middleware/ContentMiddleware";

export const store = configureStore({
  reducer: AppReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // TODO GET RID OF THIS BEFORE MERGING
      serializableCheck: {
        ignoredActions: ["environment/authclient"],
        ignoredPaths: ["environment.authClient"],
      },
      // TODO GET RID OF THIS TOO BEFORE MERGING
      immutableCheck: {
        ignoredPaths: ["environment.authClient"],
      },
    }).concat(
      environmentApi.middleware,
      EnvironmentMiddleware,
      ContentMiddleware,
    ),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
