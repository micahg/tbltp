import React, { lazy, Suspense } from "react";

const LazyAuthRedirectingComponent = lazy(
  () => import("./AuthRedirectingComponent"),
);

const AuthRedirectingComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyAuthRedirectingComponent {...props} />
  </Suspense>
);

export default AuthRedirectingComponent;
