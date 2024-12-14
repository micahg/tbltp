import React, { lazy, Suspense } from "react";

const LazyFindTokenComponent = lazy(() => import("./FindTokenComponent"));

const FindTokenComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyFindTokenComponent {...props} />
  </Suspense>
);

export default FindTokenComponent;
