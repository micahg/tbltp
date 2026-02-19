type AccessTokenGetter = () => Promise<string>;

let accessTokenGetter: AccessTokenGetter | undefined;

export function registerAccessTokenGetter(getter: AccessTokenGetter) {
  accessTokenGetter = getter;
}

export function clearAccessTokenGetter(getter?: AccessTokenGetter) {
  if (!getter || accessTokenGetter === getter) {
    accessTokenGetter = undefined;
  }
}

export async function getAccessToken(): Promise<string> {
  if (!accessTokenGetter) {
    throw new Error("No access token getter registered");
  }
  return accessTokenGetter();
}

export async function getAuthHeaders(
  headers: { [key: string]: string } = {},
): Promise<{ [key: string]: string }> {
  try {
    const accessToken = await getAccessToken();
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
