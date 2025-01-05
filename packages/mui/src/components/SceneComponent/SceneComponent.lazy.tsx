import React, { lazy, Suspense } from "react";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { Scene } from "@micahg/tbltp-common";

const LazySceneComponent = lazy(() => import("./SceneComponent"));

const SceneComponent = (
  props: JSX.IntrinsicAttributes & {
    populateToolbar?: (actions: GameMasterAction[]) => void;
    redrawToolbar?: () => void;
    scene?: Scene;
    editScene?: () => void;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazySceneComponent {...props} />
  </Suspense>
);

export default SceneComponent;
