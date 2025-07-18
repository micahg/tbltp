import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface EnvironmentState {
  readonly ratelimitRemaining: number;
  readonly ratelimit: number;
  readonly ratelimitMax: number;
}

const initialState: EnvironmentState = {
  ratelimitRemaining: -1,
  ratelimit: -1,
  ratelimitMax: -1,
};

export const environmentSlice = createSlice({
  name: "environment",
  initialState,
  reducers: {
    setRateLimit: (
      state,
      action: PayloadAction<{ limit: number; remaining: number }>,
    ) => {
      const { limit: l, remaining: r } = action.payload;
      const u = l - r;
      const m = Math.max(state.ratelimitMax, u);
      state.ratelimit = l;
      state.ratelimitRemaining = r;
      state.ratelimitMax = m;
    },
  },
});

export const { setRateLimit } = environmentSlice.actions;
