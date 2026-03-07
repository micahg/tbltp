import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { environmentApi } from "./environment";
import { getAuthHeaders } from "../utils/authBridge";

export interface TableStateResponse {
  _id?: string;
  user?: string;
  scene?: string | null;
}

export interface UpdateTableStateRequest {
  scene: string;
}

const rawBaseQuery = fetchBaseQuery({ baseUrl: "/" });

const tableStateBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const selectEnvironmentConfig =
    environmentApi.endpoints.getEnvironmentConfig.select();
  const env = selectEnvironmentConfig(
    api.getState() as Parameters<typeof selectEnvironmentConfig>[0],
  ).data;

  if (!env?.api) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        error: "Environment API config is not loaded",
      },
    };
  }

  try {
    const authHeaders = await getAuthHeaders();
    const request =
      typeof args === "string"
        ? {
            url: `${env.api}${args}`,
            headers: authHeaders,
          }
        : {
            ...args,
            url: `${env.api}${args.url}`,
            headers: {
              ...(args.headers as Record<string, string> | undefined),
              ...authHeaders,
            },
          };

    return rawBaseQuery(request, api, extraOptions);
  } catch (error) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        error: String(error),
      },
    };
  }
};

export const tableStateApi = createApi({
  reducerPath: "tableStateApi",
  baseQuery: tableStateBaseQuery,
  tagTypes: ["TableState"],
  endpoints: (build) => ({
    getTableState: build.query<TableStateResponse | null, void>({
      query: () => ({ url: "/state" }),
      providesTags: [{ type: "TableState", id: "CURRENT" }],
    }),
    updateTableState: build.mutation<void, UpdateTableStateRequest>({
      query: (tableState) => ({
        url: "/state",
        method: "PUT",
        body: tableState,
        responseHandler: "text",
      }),
      transformResponse: () => undefined,
      invalidatesTags: [{ type: "TableState", id: "CURRENT" }],
    }),
  }),
});

export const { useGetTableStateQuery, useUpdateTableStateMutation } =
  tableStateApi;
