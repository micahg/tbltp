import { configureStore } from "@reduxjs/toolkit";
import { AppReducer } from "./reducers/AppReducer";
import { EnvironmentMiddleware } from "./middleware/EnvironmentMiddleware";
import { ContentMiddleware } from "./middleware/ContentMiddleware";

export const store = configureStore({
  reducer: AppReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(EnvironmentMiddleware, ContentMiddleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
