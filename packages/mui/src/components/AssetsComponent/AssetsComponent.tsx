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

  const selectFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.onchange = () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      if (!file) return;
      // content / updateasset;
      const payload = { asset: file, progress: () => {} };
      dispatch({ type: "content/updateasset", payload: payload });
    };
    input.click();
  };

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [
      {
        icon: Upload,
        tooltip: "Upload Asset",
        hidden: () => false,
        disabled: () => false,
        callback: () => {
          selectFile();
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
