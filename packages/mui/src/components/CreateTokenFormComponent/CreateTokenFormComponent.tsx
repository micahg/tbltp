// import styles from "./CreateTokenFormComponent.module.css";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { Asset, Token } from "@micahg/tbltp-common";
import { useEffect } from "react";
import { NAME_REGEX } from "../SceneComponent/SceneComponent";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent";

const CreateTokenFormComponent = () => {
  const {
    reset,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Token>({ mode: "onBlur" });

  const dispatch = useDispatch();

  const assets = useSelector((state: AppReducerState) => state.content.assets);

  const onSubmit = (data: Token) => {
    // don't send an empty asset
    if (data.asset === "") {
      delete data.asset;
    }
    if (data.hitPoints === 0) {
      delete data.hitPoints;
    }
    console.log(data);
    dispatch({ type: "content/updatetoken", payload: data });
    reset();
  };

  useEffect(() => {
    if (!dispatch) return;
    dispatch({ type: "content/assets" });
  }, [dispatch]);

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
        <ErrorAlertComponent />
        <FormControl fullWidth>
          <Controller
            name="name"
            control={control}
            defaultValue=""
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
            defaultValue={false}
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
            defaultValue=""
            render={({ field }) => (
              <Select {...field} labelId="asset-label" label="Asset">
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {assets.map((asset: Asset) => (
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
            defaultValue={0}
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
          <Button type="submit" variant="contained" color="primary">
            Submit
          </Button>
        </Box>
      </Box>
    </form>
  );
};

export default CreateTokenFormComponent;
