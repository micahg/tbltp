// import styles from "./ContentEditor.module.css";

import { Box, Grid } from "@mui/material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Upload } from "@mui/icons-material";
import { AppReducerState } from "../../reducers/AppReducer";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent.lazy";
import AssetPanelComponent from "../AssetPanelComponent/AssetPanelComponent.lazy";
import { Asset } from "@micahg/tbltp-common";

interface AssetsComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
}

const AssetsComponent = ({ populateToolbar }: AssetsComponentProps) => {
  const dispatch = useDispatch();
  const assets = useSelector((state: AppReducerState) => state.content.assets);

  useEffect(() => {
    if (!dispatch) return;
    dispatch({ type: "content/assets" });
  }, [dispatch]);

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [
      {
        icon: Upload,
        tooltip: "Upload Asset",
        hidden: () => false,
        disabled: () => false,
        callback: () => {
          const name = `ASSET ${assets?.length || 0}`;
          const asset: Asset = { name };
          dispatch({ type: "content/updateasset", payload: asset });
        },
      },
      {
        // work around infinite re-render (see the long blurb in
        // handlePopulateToolbar from GameMasterComponent.tsx)
        icon: Upload,
        tooltip: JSON.stringify(assets),
        hidden: () => true,
        disabled: () => true,
        callback: () => {},
      },
    ];

    populateToolbar(actions);
  }, [assets, dispatch, populateToolbar]);
  return (
    // 100vh - 64px for the toolbar - 8px for the paddings
    <Box sx={{ overflow: "auto", height: `calc(100vh - 72px)` }}>
      <ErrorAlertComponent />
      <Grid container columns={{ xs: 2, sm: 2, md: 2 }}>
        {assets !== undefined &&
          assets.map((asset: Asset) => (
            <Box key={asset._id} sx={{ margin: "12px" }}>
              <AssetPanelComponent asset={asset} readonly={false} />
            </Box>
          ))}
      </Grid>
    </Box>
  );
};

export default AssetsComponent;
