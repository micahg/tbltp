// import styles from "./ContentEditor.module.css";

import { Box, Grid, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { useEffect, useMemo, useState, MouseEvent } from "react";
import Add from "@mui/icons-material/Add";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent.lazy";
import AssetPanelComponent from "../AssetPanelComponent/AssetPanelComponent.lazy";
import { Asset } from "@micahg/tbltp-common";
import { useGetAssetsQuery, useUpdateAssetMutation } from "../../api/asset";
import { useGetScenesQuery } from "../../api/scene";
import { useGetTokensQuery } from "../../api/token";

interface AssetsComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
}

type AssetFilter = "unused" | "token" | "scene";

const AssetsComponent = ({ populateToolbar }: AssetsComponentProps) => {
  const { data: assets = [] } = useGetAssetsQuery();
  const { data: scenes = [] } = useGetScenesQuery();
  const { data: tokens = [] } = useGetTokensQuery();
  const [updateAsset] = useUpdateAssetMutation();
  const [filters, setFilters] = useState<AssetFilter[]>([]);

  // usage buckets are computed from the cached scene/token lists. the scene
  // bucket intentionally counts only direct layer references (overlay/detail/
  // player) and not scenes with placed tokens, which /asset/:id/usage also
  // reports -- the "unused" bucket is equivalent either way, since indirect
  // scene use implies token use.
  const tokenAssetIds = useMemo(
    () =>
      new Set(tokens.flatMap((token) => (token.asset ? [token.asset] : []))),
    [tokens],
  );
  const sceneAssetIds = useMemo(
    () =>
      new Set(
        scenes.flatMap((scene) =>
          [scene.overlayId, scene.detailId, scene.playerId].flatMap((id) =>
            id ? [id] : [],
          ),
        ),
      ),
    [scenes],
  );

  const usedAssetIds = useMemo(
    () => new Set([...tokenAssetIds, ...sceneAssetIds]),
    [tokenAssetIds, sceneAssetIds],
  );

  // unused is mutually exclusive with token and scene: selecting it clears
  // the others and selecting token or scene clears it. nothing selected
  // shows every asset.
  const handleFilterChange = (
    _event: MouseEvent<HTMLElement>,
    newFilters: AssetFilter[],
  ) => {
    // if the new selected filters includes unused, but the current does not,
    // make unused the only filter (token and secen assets are used)
    if (newFilters.includes("unused") && !filters.includes("unused")) {
      setFilters(["unused"]);
      return;
    }

    // otherwise something other than unused was selected, so
    // remove unused and apply the rest
    setFilters(newFilters.filter((filter) => filter !== "unused"));
  };

  const visibleAssets = assets.filter((asset) => {
    if (filters.length === 0) return true;
    const usedByToken = !!asset._id && tokenAssetIds.has(asset._id);
    const usedByScene = !!asset._id && sceneAssetIds.has(asset._id);
    if (filters.includes("unused")) return !usedByToken && !usedByScene;
    return (
      (filters.includes("token") && usedByToken) ||
      (filters.includes("scene") && usedByScene)
    );
  });

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
    <Box
      data-testid="AssetsComponent"
      sx={{ display: "flex", flexDirection: "column" }}
    >
      <Box sx={{ display: "flex", justifyContent: "center", padding: "8px" }}>
        <ToggleButtonGroup
          size="small"
          color="primary"
          value={filters}
          onChange={handleFilterChange}
        >
          <ToggleButton value="unused">Unused</ToggleButton>
          <ToggleButton value="token">Token</ToggleButton>
          <ToggleButton value="scene">Scene</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {/* 100vh - 64px for the toolbar - 8px for the paddings - 48px for the
          filter row */}
      <Box sx={{ overflow: "auto", height: `calc(100vh - 72px - 48px)` }}>
        <ErrorAlertComponent sticky={true} />
        <Grid container columns={{ xs: 2, sm: 2, md: 2 }}>
          {visibleAssets.map((asset: Asset) => (
            <Box key={asset._id} sx={{ margin: "12px" }}>
              <AssetPanelComponent
                asset={asset}
                readonly={false}
                used={asset._id ? usedAssetIds.has(asset._id) : false}
              />
            </Box>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default AssetsComponent;
