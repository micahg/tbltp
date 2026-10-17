import {
  Auth0Context,
  Auth0ContextInterface,
  initialContext,
} from "@auth0/auth0-react";

type NoAuthProviderComponentProps = {
  children: React.ReactNode;
};

const noAuthContext: Auth0ContextInterface = {
  ...initialContext,
  isAuthenticated: true,
  isLoading: false,
  user: { sub: "noauth|0" },
  getAccessTokenSilently: async () => "NOAUTH",
  logout: async () => {},
};

const NoAuthProviderComponent = ({
  children,
}: NoAuthProviderComponentProps) => (
  <Auth0Context.Provider value={noAuthContext}>
    {children}
  </Auth0Context.Provider>
);

export default NoAuthProviderComponent;
