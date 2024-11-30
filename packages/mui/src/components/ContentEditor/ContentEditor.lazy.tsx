import React, { lazy, Suspense } from "react";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";

const LazyContentEditor = lazy(() => import("./ContentEditor"));

const ContentEditor = (
  props: JSX.IntrinsicAttributes & {
    infoDrawer: () => void;
    populateToolbar?: (actions: GameMasterAction[]) => void;
    redrawToolbar?: () => void;
    manageScene?: () => void;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyContentEditor {...props} />
  </Suspense>
);

export default ContentEditor;
