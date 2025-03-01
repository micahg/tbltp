// import styles from "./CreateTokenFormComponent.module.css";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { Asset, Token } from "@micahg/tbltp-common";
import { memo, useEffect, useState } from "react";
import { NAME_REGEX } from "../SceneComponent/SceneComponent";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent";

interface CreateTokenFormComponentProps {
  token?: Token;
  modal?: boolean;
}

export const TwoMinuteTableTop = () => (
  <p>
    Need tokens? Try{" "}
    <a
      href="https://tools.2minutetabletop.com/"
      target="_blank"
      rel="noreferrer"
    >
      2-Minute Tabletop
    </a>{" "}
    and add them to your assets.
  </p>
);

const CreateTokenFormComponent = ({
  token,
  modal,
}: CreateTokenFormComponentProps) => {
  const {
    reset,
    control,
    watch,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Token>({
    mode: "onBlur",
    defaultValues: stripToken(token),
  });

  const dispatch = useDispatch();
  const assetField = watch("asset");

  const assets = useSelector((state: AppReducerState) => state.content.assets);
  const scenes = useSelector((state: AppReducerState) => state.content.scenes);
  const [file, setFile] = useState<File | undefined>(undefined);
  const [imgUrl, setImgUrl] = useState<string | undefined>(undefined);
  const [deleteWarning, setDeleteWarning] = useState<boolean>(false);
  const [tokenScenes, setTokenScenes] = useState<string[]>([]);

  const deleteToken = (force: boolean) => {
    const names: string[] = [];
    for (const scene of scenes) {
      if (!scene.tokens) continue;
      for (const instance of scene.tokens) {
        if (instance.token === token?._id) {
          if (!names.includes(scene.description)) {
            names.push(scene.description);
          }
        }
      }
    }

    if (force || !names.length) {
      setDeleteWarning(false);
      dispatch({
        type: "content/deletetoken",
        payload: token,
      });
    } else {
      setTokenScenes(names);
      setDeleteWarning(true);
    }
  };
  const handleClose = () => {
    setDeleteWarning(false);
  };

  /**
   * Strip the token properties that can't be edited so they don't
   * trigger the form to be dirty (for example, the _id is not part
   * of the form, but if its part of the object we pass to reset,
   * the form will be dirty)
   */
  function stripToken(token?: Token): Token {
    return {
      name: token?.name || "",
      asset: token?.asset || "",
      hitPoints: token?.hitPoints || 0,
    };
  }

  const onSubmit = (data: Token) => {
    // overlay the local changes
    const update = { ...token, ...data };

    // just remove the hitpoints if they are 0
    const hp = Number(data.hitPoints);
    if (hp === 0 || Number.isNaN(hp)) {
      delete update.hitPoints;
    }

    // an existing asset will be an mongo id -- new and none
    // are special cases that need to be handled
    if (data.asset === "new") {
      delete update.asset;
      dispatch({
        type: "content/createassetandtoken",
        payload: {
          asset: {
            name: data.name,
          },
          token: update,
          file: file,
        },
      });
      return;
    } else if (data.asset === "none") {
      delete update.asset;
    }

    dispatch({ type: "content/updatetoken", payload: update });
    reset(data);
  };

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

  useEffect(() => {
    if (!dispatch) return;
    if (assets) return;
    dispatch({ type: "content/assets" });
  }, [assets, dispatch]);

  useEffect(() => {
    if (!reset) return;
    if (!token) return;
    reset(stripToken(token));
  }, [reset, token]);

  /**
   * Watch for asset changes
   *
   * TODO: render asset preview
   */
  useEffect(() => {
    if (!assetField) return;
    if (assetField === "new") {
      selectFile();
    }
  }, [assetField]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          gap: "1em",
        }}
      >
        <Dialog open={deleteWarning}>
          <DialogTitle>Delete Token</DialogTitle>
          <DialogContent>
            <DialogContentText>
              <p>
                The following scenes are still using this token:{" "}
                {tokenScenes.join(", ")}.
              </p>
              <p>
                Please confirm deletion of the token along with all instances
                within the scenes.
              </p>
            </DialogContentText>
            <DialogActions>
              <Button onClick={handleClose} autoFocus>
                Cancel
              </Button>
              <Button onClick={() => deleteToken(true)}>Delete</Button>
            </DialogActions>
          </DialogContent>
        </Dialog>
        {modal && <ErrorAlertComponent />}
        {modal && <TwoMinuteTableTop />}
        <FormControl fullWidth>
          <Controller
            name="name"
            control={control}
            rules={{
              required: "Name is required",
              pattern: {
                value: NAME_REGEX,
                message: "Name must be alphanumeric",
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Name"
                error={!!errors.name}
                helperText={errors.name ? (errors.name.message as string) : ""}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="asset-label">Asset</InputLabel>
          <Controller
            name="asset"
            control={control}
            render={({ field }) => (
              <Select {...field} labelId="asset-label" label="Asset">
                <MenuItem value="new">
                  <em>Upload New Asset</em>
                </MenuItem>
                <MenuItem value="none">
                  <em>None</em>
                </MenuItem>
                {assets !== undefined &&
                  assets.map((asset: Asset) => (
                    <MenuItem key={asset._id} value={asset._id}>
                      {asset.name}
                    </MenuItem>
                  ))}
              </Select>
            )}
          />
        </FormControl>
        <FormControl fullWidth>
          <Controller
            name="hitPoints"
            control={control}
            rules={{
              min: { value: 0, message: `Min value is ${0}` },
              max: { value: 1000, message: `Max value is ${1000}` },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Hit Points"
                type="number"
                error={!!errors.hitPoints}
                helperText={
                  errors.hitPoints ? (errors.hitPoints.message as string) : ""
                }
              />
            )}
          />
        </FormControl>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "right",
            alignItems: "center",
            width: "100%",
          }}
        >
          {modal ? (
            <Button type="submit" variant="contained" color="primary">
              Submit
            </Button>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "right",
              }}
            >
              <Tooltip title="Save your changes to the token">
                <span>
                  <IconButton
                    type="submit"
                    aria-label="save"
                    color="primary"
                    disabled={!isDirty}
                  >
                    <SaveIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete this token">
                <span>
                  <IconButton
                    aria-label="delete"
                    color="primary"
                    onClick={() => deleteToken(false)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>
    </form>
  );
};

export default memo(CreateTokenFormComponent, (prev, next) => {
  return (
    prev.token?._id === next.token?._id &&
    prev.token?.name === next.token?.name &&
    prev.token?.asset === next.token?.asset &&
    prev.token?.hitPoints === next.token?.hitPoints
  );
});
