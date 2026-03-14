// import styles from "./ContentEditor.module.css";

import { Box, Grid } from "@mui/material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { useEffect } from "react";
import Add from "@mui/icons-material/Add";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent.lazy";
import AssetPanelComponent from "../AssetPanelComponent/AssetPanelComponent.lazy";
import { Asset } from "@micahg/tbltp-common";
import { useGetAssetsQuery, useUpdateAssetMutation } from "../../api/asset";

interface AssetsComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
}

const AssetsComponent = ({ populateToolbar }: AssetsComponentProps) => {
  const { data: assets = [] } = useGetAssetsQuery();
  const [updateAsset] = useUpdateAssetMutation();

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [
      {
        icon: Add,
        tooltip: "Create Asset",
        hidden: () => false,
        disabled: () => false,
        callback: () => {
          const name = `ASSET ${assets?.length || 0}`;
          const asset: Asset = { name };
          updateAsset(asset);
        },
      },
      {
        // work around infinite re-render (see the long blurb in
        // handlePopulateToolbar from GameMasterComponent.tsx)
        icon: Add,
        tooltip: JSON.stringify(assets),
        hidden: () => true,
        disabled: () => true,
        callback: () => {},
      },
    ];

    populateToolbar(actions);
  }, [assets, populateToolbar, updateAsset]);
  return (
    // 100vh - 64px for the toolbar - 8px for the paddings
    <Box sx={{ overflow: "auto", height: `calc(100vh - 72px)` }}>
      <ErrorAlertComponent sticky={true} />
      <Grid container columns={{ xs: 2, sm: 2, md: 2 }}>
        {assets.map((asset: Asset) => (
          <Box key={asset._id} sx={{ margin: "12px" }}>
            <AssetPanelComponent asset={asset} readonly={false} />
          </Box>
        ))}
      </Grid>
    </Box>
  );
};

export default AssetsComponent;
