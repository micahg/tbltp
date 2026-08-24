import { useEffect, useRef, useState } from "react";
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

  // keep a ref to avoid double-authenticating
  const isRedirectingRef = useRef(false);

  // gate children rendering until the token getter is registered,
  // so child effects (RTK Query) can't fire before the getter exists
  const [getterReady, setGetterReady] = useState(false);

  useEffect(() => {
    let getter: (() => Promise<string | null>) | null;
    if (noAuthConfig?.noauth === true) {
      getter = () => Promise.resolve(null);
    } else if (isAuthenticated) {
      getter = () => getAccessTokenSilently();
    } else {
      setGetterReady(false);
      return;
    }
    registerAccessTokenGetter(getter);
    setGetterReady(true);
    return () => clearAccessTokenGetter(getter);
  }, [getAccessTokenSilently, isAuthenticated, noAuthConfig]);

  useEffect(() => {
    if (
      noAuthConfig?.noauth === true ||
      isLoading ||
      isAuthenticated ||
      isRedirectingRef.current
    ) {
      return;
    }
    isRedirectingRef.current = true;
    loginWithRedirect();
  }, [isAuthenticated, isLoading, loginWithRedirect, noAuthConfig?.noauth]);

  // if configured to operate without auth, just render the children
  if (noAuthConfig?.noauth === true) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <AuthLoadingComponent />;
  }

  if (!isAuthenticated) {
    return <AuthLoadingComponent />;
  }

  if (!getterReady) {
    return <AuthLoadingComponent />;
  }

  return <>{children}</>;
};

export default AuthenticationGuardComponent;
