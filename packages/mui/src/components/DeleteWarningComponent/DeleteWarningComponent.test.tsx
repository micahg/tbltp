import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeleteWarningComponent from "./DeleteWarningComponent";

describe("<DeleteWarningComponent />", () => {
  test("it should mount", () => {
    render(
      <DeleteWarningComponent
        open={false}
        deletionType={"test"}
        handleClose={() => null}
        handleDelete={() => null}
      />,
    );

    const deleteWarningComponent = screen.getByTestId("DeleteWarningComponent");

    expect(deleteWarningComponent).toBeInTheDocument();
  });
});
