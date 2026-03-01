import React, { lazy, Suspense } from "react";

const LazyEnvConfigGuardComponent = lazy(
  () => import("./EnvConfigGuardComponent"),
);

const EnvConfigGuardComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyEnvConfigGuardComponent {...props} />
  </Suspense>
);

export default EnvConfigGuardComponent;
