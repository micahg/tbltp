type AccessTokenGetter = () => Promise<string | null>;

let accessTokenGetter: AccessTokenGetter | undefined;

export function registerAccessTokenGetter(getter: AccessTokenGetter) {
  accessTokenGetter = getter;
}

export function clearAccessTokenGetter(getter?: AccessTokenGetter) {
  if (!getter || accessTokenGetter === getter) {
    accessTokenGetter = undefined;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (!accessTokenGetter) {
    return null;
  }
  return accessTokenGetter();
}

export async function getAuthHeaders(
  headers: { [key: string]: string } = {},
): Promise<{ [key: string]: string }> {
  try {
    // get the access token from the registered access token getter
    const accessToken = await getAccessToken();

    // for NOAUTH mode, null is returned, so skip the auth header
    if (!accessToken) {
      return headers;
    }

    // otherwise, we haven an access token, so return the auth header
    return {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    };
  } catch (error) {
    console.error("Unable to build auth headers", {
      hasGetter: !!accessTokenGetter,
      error,
    });
    throw error;
  }
}
