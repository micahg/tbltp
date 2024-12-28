import React, { lazy, Suspense } from "react";

const LazyUnavailableComponent = lazy(() => import("./UnavailableComponent"));

const UnavailableComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyUnavailableComponent {...props} />
  </Suspense>
);

export default UnavailableComponent;
