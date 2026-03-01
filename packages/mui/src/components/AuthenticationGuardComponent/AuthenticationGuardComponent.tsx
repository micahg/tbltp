import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  clearAccessTokenGetter,
  registerAccessTokenGetter,
} from "../../utils/authBridge";
import AuthLoadingComponent from "../AuthLoadingComponent/AuthLoadingComponent";
import { useGetNoAuthConfigQuery } from "../../api/environment";

type AuthenticationGuardComponentProps = {
  children: React.ReactNode;
};

const AuthenticationGuardComponent = ({
  children,
}: AuthenticationGuardComponentProps) => {
  const {
    getAccessTokenSilently,
    isLoading,
    isAuthenticated,
    loginWithRedirect,
  } = useAuth0();

  // if this isn't parented by the EnvConfigGuardComponent,
  // we'd need to skip this query until we have the environmentConfig
  const { data: noAuthConfig } = useGetNoAuthConfigQuery();

  useEffect(() => {
    let getter: (() => Promise<string | null>) | null;
    if (noAuthConfig?.noauth === true) {
      getter = () => Promise.resolve(null);
    } else if (isAuthenticated) {
      getter = () => getAccessTokenSilently();
    } else {
      return;
    }
    registerAccessTokenGetter(getter);
    return () => clearAccessTokenGetter(getter);
  }, [getAccessTokenSilently, isAuthenticated, noAuthConfig]);

  if (isLoading) {
    return <AuthLoadingComponent />;
  }

  if (!isAuthenticated) {
    loginWithRedirect();
    return <AuthLoadingComponent />;
  }

  return <>{children}</>;
};

export default AuthenticationGuardComponent;
