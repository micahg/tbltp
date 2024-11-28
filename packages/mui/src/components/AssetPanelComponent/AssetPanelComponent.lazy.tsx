import { Asset } from "@micahg/tbltp-common";
import React, { lazy, Suspense } from "react";

const LazyAssetPanelComponent = lazy(() => import("./AssetPanelComponent"));

const AssetPanelComponent = (
  props: JSX.IntrinsicAttributes & {
    asset: Asset;
    readonly: boolean;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyAssetPanelComponent {...props} />
  </Suspense>
);

export default AssetPanelComponent;
