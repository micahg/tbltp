import { fireEvent, render, screen } from "@testing-library/react";
import Add from "@mui/icons-material/Add";
import GameMasterActionComponent from "./GameMasterActionComponent";

describe("<GameMasterActionComponent />", () => {
  test("renders visible actions and invokes their callback", () => {
    const callback = jest.fn();

    render(
      <GameMasterActionComponent
        actions={[
          {
            icon: Add,
            tooltip: "Create token",
            callback,
            disabled: () => false,
            hidden: () => false,
          },
        ]}
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("does not render hidden actions", () => {
    render(
      <GameMasterActionComponent
        actions={[
          {
            icon: Add,
            tooltip: "Hidden action",
            callback: jest.fn(),
            disabled: () => false,
            hidden: () => true,
          },
        ]}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
