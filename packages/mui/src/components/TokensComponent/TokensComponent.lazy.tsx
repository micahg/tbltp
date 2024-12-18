import React, { lazy, Suspense } from "react";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";

const LazyTokensComponent = lazy(() => import("./TokensComponent"));

const TokensComponent = (
  props: JSX.IntrinsicAttributes & {
    populateToolbar?: (actions: GameMasterAction[]) => void;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyTokensComponent {...props} />
  </Suspense>
);

export default TokensComponent;
