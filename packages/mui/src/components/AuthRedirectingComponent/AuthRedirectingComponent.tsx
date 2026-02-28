import { Box, Paper, Typography } from "@mui/material";

const AuthRedirectingComponent = () => {
  return (
    <Box sx={{ padding: "1em" }}>
      <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
        <Typography variant="h5" gutterBottom>
          Redirecting
        </Typography>
        <Typography>Redirecting to authenticate...</Typography>
      </Paper>
    </Box>
  );
};

export default AuthRedirectingComponent;