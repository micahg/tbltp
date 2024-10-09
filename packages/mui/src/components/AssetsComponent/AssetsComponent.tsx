// import styles from "./ContentEditor.module.css";

import { Box } from "@mui/material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

interface AssetsComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
}

const AssetsComponent = ({ populateToolbar }: AssetsComponentProps) => {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [];
    populateToolbar(actions);
    return () => {
      // clear the error if there is one
      dispatch({ type: "content/error" });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Box>AssetsComponent Component</Box>;
};

export default AssetsComponent;
