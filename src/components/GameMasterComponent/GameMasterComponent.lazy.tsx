import React, { lazy, Suspense } from "react";

const LazyGameMasterComponent = lazy(() => import("./GameMasterComponent"));

const GameMasterComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyGameMasterComponent {...props} />
  </Suspense>
);

export default GameMasterComponent;
