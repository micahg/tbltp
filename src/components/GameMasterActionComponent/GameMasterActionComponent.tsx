import { createElement } from 'react';
import { Box, IconButton, SvgIcon, Tooltip } from '@mui/material';

export interface GameMasterAction {
  icon: typeof SvgIcon;
  tooltip: string;
  callback: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled: () => boolean;
  hidden: () => boolean;
}

interface GameMasterActionComponentProps {
  actions?: GameMasterAction[];
}

const GameMasterActionComponent = ({actions}: GameMasterActionComponentProps) => {
  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row-reverse' }}>
      {
        actions?.map((action, idx) => {
          return (
            !action.hidden() && <Tooltip key={idx} title={action.tooltip}>
              <IconButton onClick={action.callback} disabled={action.disabled()}>
                {createElement(action.icon)}
              </IconButton>
            </Tooltip>
          )
        })
      }
    </Box>
  )
};

export default GameMasterActionComponent;
