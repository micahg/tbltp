import React, { lazy, Suspense } from "react";
import { Scene } from "../../reducers/ContentReducer";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";

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
