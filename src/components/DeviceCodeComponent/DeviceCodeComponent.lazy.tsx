import React, { lazy, Suspense } from 'react';

const LazyDeviceCodeComponent = lazy(() => import('./DeviceCodeComponent'));

const DeviceCodeComponent = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyDeviceCodeComponent {...props} />
  </Suspense>
);

export default DeviceCodeComponent;
