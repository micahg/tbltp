import React, { lazy, Suspense } from "react";

const LazyEditorIntroductionComponent = lazy(
  () => import("./EditorIntroductionComponent"),
);

const EditorIntroductionComponent = (
  props: JSX.IntrinsicAttributes & { children?: React.ReactNode },
) => (
  <Suspense fallback={null}>
    <LazyEditorIntroductionComponent {...props} />
  </Suspense>
);

export default EditorIntroductionComponent;
