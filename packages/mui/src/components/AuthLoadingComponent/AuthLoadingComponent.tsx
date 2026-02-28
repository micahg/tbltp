import { Box, Paper, Typography } from "@mui/material";

const AuthLoadingComponent = () => {
  return (
    <Box sx={{ padding: "1em" }}>
      <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
        <Typography variant="h5" gutterBottom>
          Loading
        </Typography>
        <Typography>Loading environment configuration...</Typography>
      </Paper>
    </Box>
  );
};

export default AuthLoadingComponent;