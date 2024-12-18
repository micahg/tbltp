// import styles from "./CreateTokenFormComponent.module.css";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
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
import { memo, useEffect } from "react";
import { NAME_REGEX } from "../SceneComponent/SceneComponent";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent";

interface CreateTokenFormComponentProps {
  token?: Token;
  modal?: boolean;
}

const CreateTokenFormComponent = ({
  token,
  modal,
}: CreateTokenFormComponentProps) => {
  console.log(`MICAH token is ${JSON.stringify(token)}`);
  const {
    reset,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Token>({
    mode: "onBlur",
    defaultValues: {
      name: token?.name || "",
      visible: token?.visible || false,
      asset: token?.asset || "",
      hitPoints: token?.hitPoints || 0,
    },
  });

  const dispatch = useDispatch();

  const assets = useSelector((state: AppReducerState) => state.content.assets);
  const deleteToken = () =>
    dispatch({
      type: "content/deletetoken",
      payload: token,
    });

  const onSubmit = (data: Token) => {
    // don't send an empty asset
    if (data.asset === "") {
      delete data.asset;
    }
    if (data.hitPoints === 0) {
      delete data.hitPoints;
    }

    if (token) {
      data = { ...token, ...data };
    }
    console.log(data);
    dispatch({ type: "content/updatetoken", payload: data });
    reset(data);
  };

  useEffect(() => {
    if (!dispatch) return;
    if (assets) return;
    dispatch({ type: "content/assets" });
  }, [assets, dispatch]);

  useEffect(() => {
    if (!reset) return;
    if (!token) return;
    reset(token);
  }, [reset, token]);

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
        {modal && <ErrorAlertComponent />}
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
          <Controller
            name="visible"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                {...field}
                control={<Checkbox />}
                label="Player Visible"
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
                <MenuItem value="">
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
                    aria-label="save"
                    color="primary"
                    disabled={!isDirty}
                    // onClick={updateAsset}
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
                    onClick={deleteToken}
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
    prev.token?.visible === next.token?.visible &&
    prev.token?.asset === next.token?.asset &&
    prev.token?.hitPoints === next.token?.hitPoints
  );
});
