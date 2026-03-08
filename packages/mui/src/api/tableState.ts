import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { environmentApi } from "./environment";
import { getAuthHeaders } from "../utils/authBridge";
import { ratelimit } from "../slices/rateLimitSlice";

export interface TableStateResponse {
  _id?: string;
  user?: string;
  scene?: string | null;
}

export interface UpdateTableStateRequest {
  scene: string;
}

function dispatchRateLimitFromHeaders(
  dispatch: (action: unknown) => void,
  limit: string | null,
  remaining: string | null,
) {
  if (!limit || !remaining) {
    return;
  }

  dispatch(ratelimit({ limit, remaining }));
}

function dispatchRateLimitFromMeta(
  dispatch: (action: unknown) => void,
  meta: unknown,
) {
  const response =
    typeof meta === "object" && meta !== null && "response" in meta
      ? (meta as { response?: Response }).response
      : undefined;
  dispatchRateLimitFromHeaders(
    dispatch,
    response?.headers.get("ratelimit-limit") ?? null,
    response?.headers.get("ratelimit-remaining") ?? null,
  );
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

    const result = await rawBaseQuery(request, api, extraOptions);
    dispatchRateLimitFromMeta(api.dispatch, result.meta);
    return result;
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
