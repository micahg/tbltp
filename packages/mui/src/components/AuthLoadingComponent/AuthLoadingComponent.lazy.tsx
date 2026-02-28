import React, { lazy, Suspense } from "react";

const LazyAuthLoadingComponent = lazy(() => import("./AuthLoadingComponent"));

const AuthLoadingComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyAuthLoadingComponent {...props} />
  </Suspense>
);

export default AuthLoadingComponent;
