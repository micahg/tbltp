import { Scene } from "@micahg/tbltp-common";
import React, { lazy, Suspense } from "react";

const LazyNavigationDrawerComponent = lazy(
  () => import("./NavigationDrawerComponent"),
);

const NavigationDrawerComponent = (
  props: JSX.IntrinsicAttributes & {
    scenesOpen: boolean;
    handleViewAssets: () => void;
    handleViewTokens: () => void;
    handleCreateScene: () => void;
    handleEditScene: (scene?: Scene) => void;
    scenesClick: () => void;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyNavigationDrawerComponent {...props} />
  </Suspense>
);

export default NavigationDrawerComponent;
