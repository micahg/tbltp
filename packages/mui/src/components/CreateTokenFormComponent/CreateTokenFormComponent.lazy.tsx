import React, { lazy, Suspense } from "react";

const LazyCreateTokenFormComponent = lazy(
  () => import("./CreateTokenFormComponent"),
);

const CreateTokenFormComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyCreateTokenFormComponent {...props} />
  </Suspense>
);

export default CreateTokenFormComponent;
