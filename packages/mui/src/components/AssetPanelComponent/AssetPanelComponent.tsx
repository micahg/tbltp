import {
  Box,
  CircularProgress,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ChangeEvent, memo, useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import styles from "./AssetPanelComponent.module.css";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import InfoIcon from "@mui/icons-material/Info";
import { Asset } from "@micahg/tbltp-common";
import DeleteWarningComponent from "../DeleteWarningComponent/DeleteWarningComponent.lazy";
import { environmentApi } from "../../api/environment";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useDeleteAssetMutation,
  useLazyGetAssetUsageQuery,
  useUpdateAssetDataMutation,
  useUpdateAssetMutation,
} from "../../api/asset";
import { setError } from "../../slices/editorUiSlice";
import {
  errorMessageForDeleteError,
  errorMessageForUpdateError,
} from "../../utils/errors";

interface AssetPanelComponentProps {
  asset: Asset;
  readonly: boolean;
}

const AssetPanelComponent = ({ asset, readonly }: AssetPanelComponentProps) => {
  const api = useSelector(
    (state: AppReducerState) =>
      environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api,
  );
  const { getAccessTokenSilently } = useAuth0();
  const [updateAssetMutation] = useUpdateAssetMutation();
  const [updateAssetDataMutation] = useUpdateAssetDataMutation();
  const [deleteAssetMutation] = useDeleteAssetMutation();
  const [getAssetUsage, usageResult] = useLazyGetAssetUsageQuery();
  const dispatch = useDispatch();

  const [bearer, setBearer] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState(asset.name);
  const [file, setFile] = useState<File | null>(null);
  const [expand, setExpand] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<boolean>(false);
  const [showUsage, setShowUsage] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const saveDisabled = name === asset.name && !file;

  useEffect(() => {
    getAccessTokenSilently()
      .then((token) => setBearer(token))
      .catch(() => setBearer(null));
  }, [getAccessTokenSilently]);

  useEffect(() => {
    if (!asset.location || !api || !bearer) {
      setImgUrl(null);
      return;
    }
    setImgUrl(`${api}/${asset.location}?token=${bearer}`);
  }, [api, asset.location, bearer]);

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

  const toggleUsage = useCallback(() => {
    if (!showUsage && asset._id) {
      getAssetUsage(asset._id);
    }
    setShowUsage(!showUsage);
  }, [asset._id, getAssetUsage, showUsage]);

  const updateAsset = async () => {
    // even though this component is memoized, after updating we need to clear name and file
    // to prevent saveDisabled from being false (on account of File being truthy)
    try {
      if (name !== asset.name) {
        await updateAssetMutation({ ...asset, name }).unwrap();
        setName(name);
      }

      if (file && asset._id) {
        await updateAssetDataMutation({
          id: asset._id,
          file,
          progress: (p) => setProgress(p.progress * 100),
        }).unwrap();
        setFile(null);
      }
      dispatch(setError(undefined));
    } catch (err) {
      console.log(`Unable to update asset: ${JSON.stringify(err)}`);
      dispatch(
        setError({ msg: errorMessageForUpdateError(err), success: false }),
      );
    } finally {
      setProgress(0);
    }
  };

  const deleteAsset = async () => {
    setDeleteWarning(false);
    if (!asset._id) return;
    try {
      await deleteAssetMutation(asset).unwrap();
      dispatch(setError(undefined));
    } catch (err) {
      console.log(`Unable to delete asset: ${JSON.stringify(err)}`);
      dispatch(
        setError({
          msg: errorMessageForDeleteError(err),
          success: false,
        }),
      );
    }
  };

  return (
    <Box
      data-testid="AssetPanelComponent"
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
        handleClose={() => setDeleteWarning(false)}
        handleDelete={deleteAsset}
        entity={asset}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
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
            <Tooltip title="Show where this asset is used">
              <span>
                <IconButton
                  aria-label="info"
                  color="primary"
                  disabled={!asset._id}
                  onClick={toggleUsage}
                >
                  <InfoIcon />
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
                  onClick={() => setDeleteWarning(true)}
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          {showUsage && (
            <Box
              data-testid="AssetUsageSection"
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5em",
              }}
            >
              {usageResult.isFetching ? (
                <CircularProgress size={24} />
              ) : usageResult.isError ? (
                <Typography color="error">
                  Unable to load asset usage
                </Typography>
              ) : (
                <>
                  <Typography variant="subtitle2">Tokens</Typography>
                  {usageResult.data && usageResult.data.tokens.length > 0 ? (
                    usageResult.data.tokens.map((token) => (
                      <Typography key={token._id ?? token.name} variant="body2">
                        {token.name} ({token._id})
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2">
                      Not used by any tokens
                    </Typography>
                  )}
                  <Typography variant="subtitle2">Scenes</Typography>
                  {usageResult.data && usageResult.data.scenes.length > 0 ? (
                    usageResult.data.scenes.map((scene) => (
                      <Typography
                        key={scene._id ?? scene.description}
                        variant="body2"
                      >
                        {scene.description} ({scene._id})
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2">
                      Not used in any scenes
                    </Typography>
                  )}
                </>
              )}
            </Box>
          )}
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
