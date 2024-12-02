// import styles from "./CreateTokenFormComponent.module.css";
import { Box, Button, TextField } from "@mui/material";

// interface CreateTokenFormComponentProps {}

const CreateTokenFormComponent = () => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        gap: "0.25em",
      }}
    >
      <TextField
        autoFocus
        label="Name"
        variant="standard"
        sx={{ m: 1, margin: "1em" }}
      ></TextField>
      <TextField
        autoFocus
        label="Asset"
        variant="standard"
        sx={{ m: 1, margin: "1em" }}
      ></TextField>
      <TextField id="hp" label="Hit Points" type="number" variant="standard" />
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "right",
          alignItems: "center",
          width: "100%",
        }}
      >
        <Button variant="outlined">Create</Button>
      </Box>
    </Box>
  );
};

export default CreateTokenFormComponent;
