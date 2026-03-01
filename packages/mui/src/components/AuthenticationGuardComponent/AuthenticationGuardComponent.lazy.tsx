import React, { lazy, Suspense } from "react";

const LazyAuthenticationGuardComponent = lazy(
  () => import("./AuthenticationGuardComponent"),
);

const AuthenticationGuardComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyAuthenticationGuardComponent {...props} />
  </Suspense>
);

export default AuthenticationGuardComponent;
