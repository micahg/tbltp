import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  clearAccessTokenGetter,
  registerAccessTokenGetter,
} from "../../utils/authBridge";

const AuthTokenBridge = () => {
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const getter = () => getAccessTokenSilently();
    registerAccessTokenGetter(getter);

    return () => clearAccessTokenGetter(getter);
  }, [getAccessTokenSilently]);

  return null;
};

export default AuthTokenBridge;
