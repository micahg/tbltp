import {
  Box,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import { memo, useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import styles from "./AssetPanelComponent.module.css";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import { LoadProgress } from "../../utils/content";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import { Asset } from "@micahg/tbltp-common";
import DeleteWarningComponent from "../DeleteWarningComponent/DeleteWarningComponent.lazy";

interface AssetPanelComponentProps {
  asset: Asset;
  readonly: boolean;
}

const AssetPanelComponent = ({ asset, readonly }: AssetPanelComponentProps) => {
  const dispatch = useDispatch();
  const api = useSelector((state: AppReducerState) => state.environment.api);
  const bearer = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );
  const tokens = useSelector((state: AppReducerState) => state.content.tokens);
  const scenes = useSelector((state: AppReducerState) => state.content.scenes);
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState(asset.name);
  const [file, setFile] = useState<File | null>(null);
  const [expand, setExpand] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<boolean>(false);
  const [imgUrl, setImgUrl] = useState<string | null>(
    asset.location ? `${api}/${asset.location}?token=${bearer}` : null,
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

  const toggleExpand = useCallback(() => {
    setExpand(!expand);
  }, [expand]);

  const updateAsset = () => {
    // even though this component is memoized, after updating we need to clear name and file
    // to prevent saveDisabled from being false (on account of File being truthy)
    if (name !== asset.name) {
      dispatch({
        type: "content/updateasset",
        payload: { ...asset, name },
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

  const handleClose = () => setDeleteWarning(false);

  const deleteAsset = (force = false) => {
    if (!tokens) {
      console.error(`Tokens not loaded`);
      return;
    }

    // map the tokens
    const tokenMap = new Map();
    for (const token of tokens) {
      if (token.asset === asset._id && !tokenMap.has(token._id)) {
        tokenMap.set(token._id, token);
      }
    }

    // map the scenes
    const sceneMap = new Map();
    for (const scene of scenes) {
      if (scene.tokens === undefined) {
        console.error(`Scene ${scene._id} has no tokens loaded`);
        return;
      }
      for (const instance of scene.tokens) {
        if (tokenMap.has(instance.token)) {
          sceneMap.set(scene._id, scene);
          break;
        }
      }
    }

    if (force || (sceneMap.size === 0 && tokenMap.size === 0)) {
      setDeleteWarning(false);
      // dispatch({
      //   type: "content/deleteasset",
      //   payload: asset,
      // });
    } else {
      // setTokenScenes(names);
      setDeleteWarning(true);
    }
    return;
  };

  /**
   * Ensure tokens are loaded
   */
  useEffect(() => {
    if (!dispatch) return;
    if (tokens !== undefined) return;
    dispatch({ type: "content/tokens" });
  }, [dispatch, tokens]);

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
      <DeleteWarningComponent
        open={deleteWarning}
        deletionType={"Asset"}
        handleClose={handleClose}
        handleDelete={deleteAsset}
      />
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={name}
          className={expand ? styles.asset_wide : styles.asset}
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
            }}
          >
            <Tooltip title="Expand">
              <span>
                <IconButton
                  aria-label="expand"
                  color="primary"
                  onClick={toggleExpand}
                >
                  <OpenInFullIcon />
                </IconButton>
              </span>
            </Tooltip>
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
                  onClick={() => deleteAsset(false)}
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
