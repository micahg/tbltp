import React, { lazy, Suspense } from "react";

const LazyAssetsComponent = lazy(() => import("./AssetsComponent"));

const AssetsComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyAssetsComponent {...props} />
  </Suspense>
);

export default AssetsComponent;
