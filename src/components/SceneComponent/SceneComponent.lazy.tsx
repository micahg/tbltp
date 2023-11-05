import React, { lazy, Suspense } from 'react';
import { Scene } from '../../reducers/ContentReducer';

const LazySceneComponent = lazy(() => import('./SceneComponent'));

const SceneComponent = (props: JSX.IntrinsicAttributes & {
  scene?: Scene;
  editScene?: () => void;
  children?: React.ReactNode;
}) => (
  <Suspense fallback={null}>
    <LazySceneComponent {...props} />
  </Suspense>
);

export default SceneComponent;
