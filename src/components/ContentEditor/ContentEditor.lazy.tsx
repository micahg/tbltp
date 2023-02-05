import React, { lazy, Suspense } from 'react';

const LazyContentEditor = lazy(() => import('./ContentEditor'));

const ContentEditor = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyContentEditor {...props} />
  </Suspense>
);

export default ContentEditor;
