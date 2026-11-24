// Serves the SPA from static assets (see wrangler.jsonc) and replaces the nginx
// container's start-up `envsubst`: /env.json and /auth.json are generated per
// request from the Worker's `vars`, so one build is promoted across environments.
// The variable names match the k8s ConfigMap / template placeholders.

interface Env {
  ASSETS: Fetcher;
  API_URL: string;
  WS_URL: string;
  AUTH_DOMAIN: string;
  CLIENT_ID: string;
  AUDIENCE_URL: string;
  REDIRECT_URL: string;
}

const json = (body: unknown): Response =>
  Response.json(body, { headers: { "Cache-Control": "no-cache" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/env.json") {
      return json({ API_URL: env.API_URL, WS_URL: env.WS_URL });
    }
    if (pathname === "/auth.json") {
      return json({
        domain: env.AUTH_DOMAIN,
        clientId: env.CLIENT_ID,
        authorizationParams: {
          audience: env.AUDIENCE_URL,
          redirect_uri: env.REDIRECT_URL,
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
