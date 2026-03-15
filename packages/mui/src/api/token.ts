import { Token } from "@micahg/tbltp-common";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { environmentApi } from "./environment";
import { getAuthHeaders } from "../utils/authBridge";
import { ratelimit } from "../slices/rateLimitSlice";

type TokenTag = { type: "Token"; id: string };

function tokenTagsForList(tokens: Token[] | undefined): TokenTag[] {
  if (!tokens) {
    return [{ type: "Token", id: "LIST" }];
  }

  return [
    ...tokens
      .filter((token) => !!token._id)
      .map((token) => ({ type: "Token" as const, id: token._id! })),
    { type: "Token", id: "LIST" },
  ];
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

const tokenBaseQuery: BaseQueryFn<
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

export const tokenApi = createApi({
  reducerPath: "tokenApi",
  baseQuery: tokenBaseQuery,
  tagTypes: ["Token"],
  endpoints: (build) => ({
    getTokens: build.query<Token[], void>({
      query: () => ({ url: "/token" }),
      providesTags: (result) => tokenTagsForList(result),
    }),
    updateToken: build.mutation<Token, Token>({
      query: (token) => ({
        url: "/token",
        method: "PUT",
        body: token,
      }),
      invalidatesTags: (_result, _error, token) => [
        { type: "Token", id: "LIST" },
        { type: "Token", id: token._id ?? "LIST" },
      ],
    }),
    deleteToken: build.mutation<Token, Token>({
      async queryFn(token, _api, _extraOptions, baseQuery) {
        if (!token._id) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Token id is required",
            },
          };
        }

        const result = await baseQuery({
          url: `/token/${token._id}`,
          method: "DELETE",
          responseHandler: "text",
        });

        if ("error" in result && result.error) {
          return { error: result.error };
        }

        if ("error" in result) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Unable to delete token",
            },
          };
        }

        return { data: token };
      },
      invalidatesTags: (_result, _error, token) => [
        { type: "Token", id: "LIST" },
        { type: "Token", id: token._id ?? "LIST" },
      ],
    }),
  }),
});

export const {
  useGetTokensQuery,
  useUpdateTokenMutation,
  useDeleteTokenMutation,
} = tokenApi;
