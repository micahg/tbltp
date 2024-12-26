import { HydratedToken } from "@micahg/tbltp-common";
import React, { lazy, Suspense } from "react";

const LazyFindTokenComponent = lazy(() => import("./FindTokenComponent"));

const FindTokenComponent = (
  props: JSX.IntrinsicAttributes & {
    onToken: (token: HydratedToken) => void;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyFindTokenComponent {...props} />
  </Suspense>
);

export default FindTokenComponent;
