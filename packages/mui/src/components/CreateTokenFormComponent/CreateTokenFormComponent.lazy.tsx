import { Token } from "@micahg/tbltp-common";
import React, { lazy, Suspense } from "react";

const LazyCreateTokenFormComponent = lazy(
  () => import("./CreateTokenFormComponent"),
);

const CreateTokenFormComponent = (
  props: JSX.IntrinsicAttributes & {
    token?: Token;
    showErrors?: boolean;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyCreateTokenFormComponent {...props} />
  </Suspense>
);

export default CreateTokenFormComponent;
