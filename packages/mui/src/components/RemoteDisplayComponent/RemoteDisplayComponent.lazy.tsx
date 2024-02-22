import React, { lazy, Suspense } from "react";

const LazyRemoteDisplayComponent = lazy(
  () => import("./RemoteDisplayComponent"),
);

const RemoteDisplayComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyRemoteDisplayComponent {...props} />
  </Suspense>
);

export default RemoteDisplayComponent;
