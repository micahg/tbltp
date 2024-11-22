import { Asset } from "../../reducers/ContentReducer";
import {
  Box,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import { memo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import styles from "./AssetPanelComponent.module.css";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import { LoadProgress } from "../../utils/content";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";

interface AssetPanelComponentProps {
  asset: Asset;
  readonly: boolean;
}

const AssetPanelComponent = ({ asset, readonly }: AssetPanelComponentProps) => {
  const dispatch = useDispatch();
  const api = useSelector((state: AppReducerState) => state.environment.api);
  const token = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );
  const [progress, setProgress] = useState(0);
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
    };
    input.click();
  };

  const updateAsset = () => {
    // even though this component is memoized, after updating we need to clear name and file
    // to prevent saveDisabled from being false (on account of File being truthy)
    if (name !== asset.name) {
      dispatch({
        type: "content/updateasset",
        payload: { asset: { ...asset, name } },
      });
      setName(name);
    }
    if (file) {
      dispatch({
        type: "content/updateassetdata",
        payload: {
          id: asset._id,
          file,
          progress: (p: LoadProgress) => setProgress(p.progress * 100),
        },
      });
      setFile(null);
    }
  };

  const deleteAsset = () => {
    dispatch({
      type: "content/deleteasset",
      payload: { asset },
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: 4,
        borderRadius: 2,
        height: "100%",
        WebkitJustifyContent: "space-between",
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
      {progress > 0 && progress < 100 && (
        <LinearProgress variant="determinate" value={progress} />
      )}
      {!readonly && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "1em",
            padding: "1em",
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
                <IconButton
                  aria-label="save"
                  color="primary"
                  disabled={saveDisabled}
                  onClick={updateAsset}
                >
                  <SaveIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete this asset">
              <span>
                <IconButton
                  aria-label="delete"
                  color="primary"
                  onClick={deleteAsset}
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default memo(AssetPanelComponent, (prev, next) => {
  return (
    prev.asset._id === next.asset._id &&
    prev.asset.name === next.asset.name &&
    prev.asset.location === next.asset.location &&
    prev.asset.revision === next.asset.revision
  );
});
