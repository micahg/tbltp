// import styles from "./ContentEditor.module.css";

import { Box } from "@mui/material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { useCallback, useEffect } from "react";
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
          const name = `ASSET ${assets.length}`;
          const asset: Asset = { name };
          dispatch({ type: "content/updateasset", payload: { asset } });
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
    <Box>
      <ErrorAlertComponent />
      {assets.map((asset, idx) => {
        return <AssetPanelComponent key={idx} asset={asset} readonly={false} />;
      })}
    </Box>
  );
};

export default AssetsComponent;
