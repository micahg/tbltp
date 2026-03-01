import React, { lazy, Suspense } from "react";

const LazyEnvLoadingComponent = lazy(() => import("./EnvLoadingComponent"));

const EnvLoadingComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyEnvLoadingComponent {...props} />
  </Suspense>
);

export default EnvLoadingComponent;
