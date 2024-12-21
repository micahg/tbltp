import React, { lazy, Suspense, ReactElement } from "react";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";

const LazyContentEditor = lazy(() => import("./ContentEditor"));

const ContentEditor = (
  props: JSX.IntrinsicAttributes & {
    infoDrawer: (info: ReactElement) => void;
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
