import React, { lazy, Suspense } from "react";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";

const LazyAssetsComponent = lazy(() => import("./AssetsComponent"));

const AssetsComponent = (
  props: JSX.IntrinsicAttributes & {
    populateToolbar?: (actions: GameMasterAction[]) => void;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyAssetsComponent {...props} />
  </Suspense>
);

export default AssetsComponent;
