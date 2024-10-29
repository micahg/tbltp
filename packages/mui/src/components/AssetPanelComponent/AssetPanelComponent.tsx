import { Asset } from "@micahg/tbltp-common";
import { Box, Button, TextField, Tooltip } from "@mui/material";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import styles from "./AssetPanelComponent.module.css";

interface AssetPanelComponentProps {
  key: number;
  asset: Asset;
  readonly: boolean;
}

const AssetPanelComponent = ({
  key,
  asset,
  readonly,
}: AssetPanelComponentProps) => {
  const dispatch = useDispatch();
  const api = useSelector((state: AppReducerState) => state.environment.api);
  const token = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );
  const imgUrl = `${api}/${asset.location}?token=${token}`;
  const [changedAsset, setChangedAsset] = useState<Asset>(asset);
  const saveDisabled = changedAsset.name === asset.name;

  const updateAsset = () => {
    const asset = { name: "NEW ASSET - CHANGE ME" };
    // assetChanged being true and asset without ID should trigger creation
    dispatch({
      type: "content/updateasset",
      payload: { asset, assetChanged: true },
    });
  };

  return (
    <Box
      key={key}
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: 4,
        borderRadius: 2,
        minHeight: "25vh",
        width: "25vw",
      }}
    >
      <img src={imgUrl} alt={asset.name} className={styles.asset} />
      {!readonly && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "1em",
            padding: 1,
          }}
        >
          <TextField
            id="name"
            label="Name"
            variant="standard"
            defaultValue={asset.name}
            // TODO DEBOUNCE CHANGE
            onChange={(e) =>
              setChangedAsset({ ...asset, name: e.target.value })
            }
          />
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "right",
              gap: "1em",
            }}
          >
            <Tooltip title="Save your changes to the asset">
              <span>
                <Button
                  variant="text"
                  disabled={saveDisabled}
                  onClick={updateAsset}
                >
                  Save
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AssetPanelComponent;
