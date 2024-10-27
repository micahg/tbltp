import React, { lazy, Suspense } from "react";

const LazyAssetPanelComponent = lazy(() => import("./AssetPanelComponent"));

const AssetPanelComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyAssetPanelComponent {...props} />
  </Suspense>
);

export default AssetPanelComponent;
