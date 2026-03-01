import { Auth0Provider } from "@auth0/auth0-react";
import GameMasterComponent from "../GameMasterComponent/GameMasterComponent.lazy";
import AuthenticationGuardComponent from "../AuthenticationGuardComponent/AuthenticationGuardComponent.lazy";
import EnvLoadingComponent from "../EnvLoadingComponent/EnvLoadingComponent.lazy";
import {
  useGetAuthConfigQuery,
  useGetNoAuthConfigQuery,
  useGetEnvironmentConfigQuery,
} from "../../api/environment";

const EnvConfigGuardComponent = () => {
  const { data: environmentConfig } = useGetEnvironmentConfigQuery();
  const { data: authConfig } = useGetAuthConfigQuery();

  // skip allows the component to rerender when the useGetEnvironmentConfigQuery state changes.
  // we need the environmentConfig to get the API URL before we can fetch the noauth config,
  // so we skip the noauth query until we have the environmentConfig.
  const { data: noAuthConfig } = useGetNoAuthConfigQuery(undefined, {
    skip: !environmentConfig?.api,
  });

  if (!environmentConfig?.api) {
    return <EnvLoadingComponent />;
  }

  if (!noAuthConfig) {
    return <EnvLoadingComponent />;
  }

  if (noAuthConfig.noauth) {
    return <GameMasterComponent />;
  }

  if (!authConfig) {
    return <EnvLoadingComponent />;
  }

  return (
    <Auth0Provider
      domain={authConfig.domain}
      clientId={authConfig.clientId}
      authorizationParams={authConfig.authorizationParams}
    >
      <AuthenticationGuardComponent>
        <GameMasterComponent />
      </AuthenticationGuardComponent>
    </Auth0Provider>
  );
};

export default EnvConfigGuardComponent;
