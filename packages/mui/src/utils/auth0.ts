import { Auth0Client, Auth0ClientOptions } from "@auth0/auth0-spa-js";

class AuthClientSingleton {
  private client: Auth0Client | null = null;

  initialize(config: Auth0ClientOptions): Auth0Client {
    if (this.client) return this.client;

    this.client = new Auth0Client(config);

    return this.client;
  }

  getClient(): Auth0Client | null {
    return this.client;
  }

  reset() {
    this.client = null;
  }
}

export const authClientSingleton = new AuthClientSingleton();
