import React, { lazy, Suspense } from 'react';

const LazyGameMasterActionComponent = lazy(() => import('./GameMasterActionComponent'));

const GameMasterActionComponent = (props: JSX.IntrinsicAttributes & { redraw: number; children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyGameMasterActionComponent {...props} />
  </Suspense>
);

export default GameMasterActionComponent;
