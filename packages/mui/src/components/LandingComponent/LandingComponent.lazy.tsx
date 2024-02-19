import React, { lazy, Suspense } from "react";

const LazyLandingComponent = lazy(() => import("./LandingComponent"));

const LandingComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyLandingComponent {...props} />
  </Suspense>
);

export default LandingComponent;
