import React, { lazy, Suspense } from "react";
import { Asset, Token } from "@micahg/tbltp-common";

const LazyDeleteWarningComponent = lazy(
  () => import("./DeleteWarningComponent"),
);

const DeleteWarningComponent = (
  props: JSX.IntrinsicAttributes & {
    open: boolean;
    deletionType: string;
    handleClose: () => void;
    handleDelete: () => void;
    entity?: Asset | Token;
    children?: React.ReactNode;
  },
) => (
  <Suspense fallback={null}>
    <LazyDeleteWarningComponent {...props} />
  </Suspense>
);

export default DeleteWarningComponent;
