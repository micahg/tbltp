// import styles from "./ContentEditor.module.css";

import { Box } from "@mui/material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Upload } from "@mui/icons-material";

interface AssetsComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
}

const AssetsComponent = ({ populateToolbar }: AssetsComponentProps) => {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [
      {
        icon: Upload,
        tooltip: "Upload Asset",
        hidden: () => false,
        disabled: () => false,
        callback: () => {
          return;
        },
      },
    ];
    populateToolbar(actions);
    return () => {
      // clear the error if there is one
      dispatch({ type: "content/error" });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Box>AssetsComponent Component</Box>;
};

export default AssetsComponent;
