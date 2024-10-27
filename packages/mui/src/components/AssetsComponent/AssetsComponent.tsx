// import styles from "./ContentEditor.module.css";

import { Box, TextField } from "@mui/material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Upload } from "@mui/icons-material";
import { AppReducerState } from "../../reducers/AppReducer";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent.lazy";

interface AssetsComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
}

const AssetsComponent = ({ populateToolbar }: AssetsComponentProps) => {
  const dispatch = useDispatch();
  const assets = useSelector((state: AppReducerState) => state.content.assets);
  const api = useSelector((state: AppReducerState) => state.environment.api);
  const token = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );

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
    // fetch assets
    dispatch({ type: "content/assets" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <ErrorAlertComponent />
      {assets.map((asset, idx) => {
        const imgUrl = `${api}/${asset.location}?token=${token}`;
        return (
          <Box
            key={idx}
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              boxShadow: 4,
              borderRadius: 2,
              padding: 1,
              minHeight: "25vh",
              width: "25vw",
            }}
          >
            <img src={imgUrl} alt={asset.name} />
            <TextField
              id="name"
              label="Name"
              variant="standard"
              defaultValue={asset.name}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default AssetsComponent;
