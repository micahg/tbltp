import React, { lazy, Suspense } from "react";

const LazyErrorAlertComponent = lazy(() => import("./ErrorAlertComponent"));

const ErrorAlertComponent = (
  props: JSX.IntrinsicAttributes & {
    sticky?: boolean;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyErrorAlertComponent {...props} />
  </Suspense>
);

export default ErrorAlertComponent;
