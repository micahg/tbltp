import { Asset } from "@micahg/tbltp-common";
import { Box, Button, TextField, Tooltip } from "@mui/material";
import { useSelector } from "react-redux";
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
  const api = useSelector((state: AppReducerState) => state.environment.api);
  const token = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );
  const imgUrl = `${api}/${asset.location}?token=${token}`;

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
                <Button variant="text">Save</Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AssetPanelComponent;
