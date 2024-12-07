// import styles from "./CreateTokenFormComponent.module.css";
import {
  // Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
// interface CreateTokenFormComponentProps {}

interface FormValues {
  name: string;
  asset?: string;
  hitPoints?: number;
}

const CreateTokenFormComponent = () => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ mode: "onBlur" });
  const onSubmit = (data: FormValues) => console.log(data);
  console.log(`Errors: ${JSON.stringify(errors)}`);
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
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
      </div>
      <div>
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
                <MenuItem value="asset1">Asset 1</MenuItem>
                <MenuItem value="asset2">Asset 2</MenuItem>
              </Select>
            )}
          />
        </FormControl>
      </div>
      <div>
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
      </div>
      <Button type="submit" variant="contained" color="primary">
        Submit
      </Button>
    </form>
    // <form onSubmit={handleSubmit(onSubmit)}>
    //   <Box
    //     sx={{
    //       display: "flex",
    //       flexDirection: "column",
    //       justifyContent: "center",
    //       alignItems: "center",
    //       width: "100%",
    //       gap: "0.25em",
    //     }}
    //   >
    //     <TextField
    //       autoFocus
    //       label="Name"
    //       variant="standard"
    //       sx={{ m: 1, margin: "1em" }}
    //       error={!!errors.name}
    //       helperText={(errors?.name?.message as string) || ""}
    //       {...(register("name"),
    //       {
    //         required: true,
    //         maxLength: { value: 2, message: "ASDF" },
    //       })}
    //     ></TextField>
    //     <TextField
    //       autoFocus
    //       label="Asset"
    //       variant="standard"
    //       sx={{ m: 1, margin: "1em" }}
    //       {...(register("asset"), { required: true })}
    //     ></TextField>
    //     <TextField
    //       id="hp"
    //       label="Hit Points"
    //       type="number"
    //       variant="standard"
    //       {...(register("hp"), { required: false, min: 0, max: 10000 })}
    //     />
    //     <Box
    //       sx={{
    //         display: "flex",
    //         flexDirection: "row",
    //         justifyContent: "right",
    //         alignItems: "center",
    //         width: "100%",
    //       }}
    //     >
    //       <Button variant="outlined" type="submit">
    //         Create
    //       </Button>
    //     </Box>
    //   </Box>
    // </form>
  );
};

export default CreateTokenFormComponent;
