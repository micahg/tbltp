import { Token } from "@micahg/tbltp-common";
import React, { lazy, Suspense } from "react";

const LazyTokenInfoDrawerComponent = lazy(
  () => import("./TokenInfoDrawerComponent"),
);

const TokenInfoDrawerComponent = (
  props: JSX.IntrinsicAttributes & {
    onToken: (token: Token) => void;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyTokenInfoDrawerComponent {...props} />
  </Suspense>
);

export default TokenInfoDrawerComponent;
