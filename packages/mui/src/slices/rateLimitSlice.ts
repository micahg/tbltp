import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppReducerState } from "../reducers/AppReducer";

export type RateLimitState = {
  readonly ratelimitRemaining: number;
  readonly ratelimit: number;
  readonly ratelimitMax: number;
};

type RateLimitPayload = {
  limit: number | string;
  remaining: number | string;
};

const initialState: RateLimitState = {
  ratelimitRemaining: -1,
  ratelimit: -1,
  ratelimitMax: -1,
};

const toRateLimitNumber = (value: number | string): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const rateLimitSlice = createSlice({
  name: "rateLimit",
  initialState,
  reducers: {
    ratelimit: (state, action: PayloadAction<RateLimitPayload>) => {
      const limit = toRateLimitNumber(action.payload.limit);
      const remaining = toRateLimitNumber(action.payload.remaining);
      if (limit === undefined || remaining === undefined) return;

      const used = limit - remaining;
      state.ratelimit = limit;
      state.ratelimitRemaining = remaining;
      state.ratelimitMax = Math.max(state.ratelimitMax, used);
    },
  },
});

export const RateLimitReducer = rateLimitSlice.reducer;
export const { ratelimit } = rateLimitSlice.actions;

export const selectRatelimit = (state: AppReducerState) =>
  state.rateLimit.ratelimit;
export const selectRatelimitRemaining = (state: AppReducerState) =>
  state.rateLimit.ratelimitRemaining;
export const selectRatelimitMax = (state: AppReducerState) =>
  state.rateLimit.ratelimitMax;
