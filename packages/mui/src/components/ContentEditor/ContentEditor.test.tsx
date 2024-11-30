import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import ContentEditor from "./ContentEditor";

describe("<ContentEditor />", () => {
  test("it should mount", () => {
    render(<ContentEditor infoDrawer={() => {}} />);

    const contentEditor = screen.getByTestId("ContentEditor");

    expect(contentEditor).toBeInTheDocument();
  });
});
