import { createElement } from "react";
import { Box, IconButton, SvgIcon, Tooltip } from "@mui/material";

export interface GameMasterAction {
  icon: typeof SvgIcon;
  tooltip: string;
  callback: (event: React.MouseEvent<HTMLButtonElement>) => void;
  // Due to closures these shouldn't be component state that change ever render.
  // check out inernalState from the existing components... I suck at react so if
  // there is a more correct way please do let me know
  disabled: () => boolean;
  hidden: () => boolean;
}

interface GameMasterActionComponentProps {
  actions?: GameMasterAction[];
}

const GameMasterActionComponent = ({
  actions,
}: GameMasterActionComponentProps) => {
  return (
    <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "row-reverse" }}>
      {actions?.map((action, idx) => {
        return (
          !action.hidden() && (
            <Tooltip key={idx} title={action.tooltip}>
              <span>
                {/* avoid tooltip complaining about disabled */}
                <IconButton
                  onClick={action.callback}
                  disabled={action.disabled()}
                >
                  {createElement(action.icon)}
                </IconButton>
              </span>
            </Tooltip>
          )
        );
      })}
    </Box>
  );
};

export default GameMasterActionComponent;
