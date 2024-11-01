import { Asset } from "../../reducers/ContentReducer";
import { Box, Button, TextField, Tooltip } from "@mui/material";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import styles from "./AssetPanelComponent.module.css";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import { LoadProgress } from "../../utils/content";

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
  const [name, setName] = useState(asset.name);
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(
    asset.location ? `${api}/${asset.location}?token=${token}` : null,
  );
  const saveDisabled = name === asset.name && !file;

  const selectFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.onchange = () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target) return;
        const data = event.target.result;
        if (typeof data !== "string") return;
        setImgUrl(data);
        setFile(file);
      };
      reader.readAsDataURL(file);
      // const payload = { id: asset._id, file, progress: () => {} };
      // dispatch({ type: "content/updateassetdata", payload: payload });
    };
    input.click();
  };

  const updateAsset = () => {
    // const asset = { name: "NEW ASSET - CHANGE ME" };
    if (name !== asset.name) {
      dispatch({
        type: "content/updateasset",
        payload: { asset: { ...asset, name } },
      });
    }
    if (file) {
      dispatch({
        type: "content/updateassetdata",
        payload: {
          id: asset._id,
          file,
          progress: (p: LoadProgress) => {
            console.error(`MICAH UPDATE THE PROGRESS ${p.progress}`);
          },
        },
      });
    }
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
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={name}
          className={styles.asset}
          onClick={selectFile}
        />
      ) : (
        <ImageSearchIcon
          sx={{ width: "25vw", height: "25vw" }}
          onClick={selectFile}
        />
      )}
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
            onChange={(e) => setName(e.target.value)}
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
