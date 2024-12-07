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
import { useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { Asset } from "../../reducers/ContentReducer";
import { Token } from "@micahg/tbltp-common";

const CreateTokenFormComponent = () => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Token>({ mode: "onBlur" });
  const assets = useSelector((state: AppReducerState) => state.content.assets);
  const onSubmit = (data: Token) => console.log(data);
  console.log(`Errors: ${JSON.stringify(errors)}`);
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
        <Controller
          name="name"
          control={control}
          defaultValue=""
          rules={{
            required: "Name is required",
            maxLength: { value: 5, message: "Max length is 5" },
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
        <Controller
          name="hitPoints"
          control={control}
          defaultValue={0}
          rules={{
            min: { value: 0, message: "Min value is 0" },
            max: { value: 1000, message: "Max value is 1000" },
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
