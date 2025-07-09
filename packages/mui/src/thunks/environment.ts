import { createAsyncThunk } from "@reduxjs/toolkit";
import { environmentApi } from "../api/environment";

export const initializeEnvironment = createAsyncThunk(
  "environment/initialize",
  async (_, { dispatch }) => {
    dispatch(environmentApi.endpoints.getEnvironmentConfig.initiate());
    dispatch(environmentApi.endpoints.getAuthenticationConfig.initiate());
  },
);
