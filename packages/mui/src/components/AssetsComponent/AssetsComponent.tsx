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
  const assets = useSelector((state: AppReducerState) => {
    console.log(`MICAH assets are ${JSON.stringify(state.content.assets)}`);
    return state.content.assets;
  });

  // const sceneManager = useCallback(() => {
  //   if (manageScene) manageScene();
  // }, [manageScene]);
  // const createAsset = useCallback(() => {
  //   console.log(`MICAH CALLBACK ${JSON.stringify(assets)}`);
  //   const asset: Asset = {
  //     name: `ASSET ${assets.length}`,
  //   };
  //   dispatch({ type: "content/updateasset", payload: { asset } });
  // }, [assets, dispatch]);
  const createAsset = useCallback(() => {
    console.log(`MICAH CALLBACK ${JSON.stringify(assets)}`);
    const asset: Asset = {
      name: `ASSET ${assets.length}`,
    };
    dispatch({ type: "content/updateasset", payload: { asset } });
  }, [assets, dispatch]);

  // const selectFile = () => {
  //   const input = document.createElement("input");
  //   input.type = "file";
  //   input.multiple = false;
  //   input.onchange = () => {
  //     if (!input.files || input.files.length === 0) return;
  //     const file = input.files[0];
  //     if (!file) return;
  //     // content / updateasset;
  //     const payload = { asset: file, progress: () => {} };
  //     dispatch({ type: "content/updateasset", payload: payload });
  //   };
  //   input.click();
  // };

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
        callback: () => createAsset(),
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
        return <AssetPanelComponent key={idx} asset={asset} readonly={false} />;
      })}
      {/* <Dialog open={showCreateDialog}>
        <DialogTitle>{"Use Google's location service?"}</DialogTitle>
        <DialogContent>
          <AssetPanelComponent key={-1} asset={empty} readonly={false} />
          <DialogContentText id="alert-dialog-slide-description">
            Let Google help apps determine location. This means sending
            anonymous location data to Google, even when no apps are running.
          </DialogContentText>
        </DialogContent>
      </Dialog> */}
    </Box>
  );
};

export default AssetsComponent;
