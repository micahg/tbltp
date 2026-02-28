import MenuIcon from "@mui/icons-material/Menu";
import {
  Edit,
  Map,
  Rectangle,
  Visibility,
  VisibilityOff,
  ZoomIn,
  ZoomOut,
} from "@mui/icons-material";
import { Box, Paper, Typography } from "@mui/material";

const EditorIntroductionComponent = () => {
  return (
    <Box sx={{ padding: "1em" }}>
      <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
        <Typography variant="h5" gutterBottom>
          Editor Crash Course
        </Typography>
        <p>Welcome, GM, to the tabletop editor.</p>
        <ul>
          <li>
            Scenes can be accessed from the{" "}
            <MenuIcon sx={{ verticalAlign: "bottom" }} /> in the top left.
          </li>
          <li>
            You can set the scene image using the{" "}
            <Map sx={{ verticalAlign: "bottom" }} /> button in the editor
            toolbar.
          </li>
          <ul>
            <li>Scenes have a player-visible image.</li>
            <li>
              Optionally, you can also set a detailed image that includes
              information that should not be shared with viewers.
            </li>
            <li>
              When you have set your images, come back and edit the
              <MenuIcon sx={{ verticalAlign: "bottom" }} /> and the scene by its
              name.
            </li>
          </ul>
          <li>
            <Edit sx={{ verticalAlign: "bottom" }} /> will allow you to paint.
          </li>
          <li>
            <Rectangle sx={{ verticalAlign: "bottom" }} /> allows you to select
            regions.
          </li>
          <ul>
            <li>
              Selected regions can be obscured &#40;
              <VisibilityOff sx={{ verticalAlign: "bottom" }} />
              &#41;, revealed &#40;
              <Visibility sx={{ verticalAlign: "bottom" }} />
              &#41; revealed, and zoomed &#40;
              <ZoomIn sx={{ verticalAlign: "bottom" }} />
              <ZoomOut sx={{ verticalAlign: "bottom" }} />
              &#41;on the remote display.
            </li>
          </ul>
        </ul>
        <p>
          Using the mouse wheel you can zoom in and out on the editor. While
          painting, the mouse wheel will change the size of your brush.
        </p>
      </Paper>
    </Box>
  );
};

export default EditorIntroductionComponent;
