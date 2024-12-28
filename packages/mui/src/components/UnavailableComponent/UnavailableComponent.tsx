import { Box, Paper, Typography } from "@mui/material";
// import styles from "./UnavailableComponent.module.css";

// interface UnavailableComponentProps {}

const UnavailableComponent = () => {
  const query = new URLSearchParams(window.location.search);
  const b64error = query.get("error");
  const error = b64error ? atob(b64error) : "Unknown Error";

  return (
    <Box sx={{ padding: "1em" }} id="UnavailableComponent">
      <Typography variant="h3" align="center" gutterBottom>
        Network Table Top
      </Typography>
      <Typography variant="h4" align="center" gutterBottom>
        ... is Unavailable ... sorry!
      </Typography>
      <p>
        The service is currently unavailable. Please try again later or contact
        the administrator. Its (probably) not you, its us.
      </p>
      <p>
        If there is an error below please pass it along to the administrator.
      </p>
      <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
        <Typography variant="h6" align="center" gutterBottom>
          Error
        </Typography>
        <Box sx={{ overflow: "auto", whiteSpace: "pre-line" }}>
          <code>{error}</code>
        </Box>
      </Paper>
    </Box>
  );
};
export default UnavailableComponent;
