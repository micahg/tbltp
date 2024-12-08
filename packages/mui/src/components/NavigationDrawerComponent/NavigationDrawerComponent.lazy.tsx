import React, { lazy, Suspense } from "react";
import { Scene } from "../../reducers/ContentReducer";

const LazyNavigationDrawerComponent = lazy(
  () => import("./NavigationDrawerComponent"),
);

const NavigationDrawerComponent = (
  props: JSX.IntrinsicAttributes & {
    scenesOpen: boolean;
    handleViewAssets: () => void;
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
