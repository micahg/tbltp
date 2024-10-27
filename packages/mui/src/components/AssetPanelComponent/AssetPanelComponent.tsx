import { Asset } from "@micahg/tbltp-common";
import { Box, TextField } from "@mui/material";
import { useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";

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
        padding: 1,
        minHeight: "25vh",
        width: "25vw",
      }}
    >
      <img src={imgUrl} alt={asset.name} />
      {!readonly && (
        <TextField
          id="name"
          label="Name"
          variant="standard"
          defaultValue={asset.name}
        />
      )}
    </Box>
  );
};

export default AssetPanelComponent;
