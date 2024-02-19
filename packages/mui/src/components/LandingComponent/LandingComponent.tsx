import { useEffect, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useNavigate, Link } from "react-router-dom";

let interval: NodeJS.Timer;
const activityListener = () => {
  clearInterval(interval);
  window.removeEventListener("mousemove", activityListener);
};

const LandingComponent = () => {
  const [countDown, setCountDown] = useState<number>(5);
  const navigate = useNavigate();

  useEffect(() => {
    // start counting down every second unless someone "jiggles" (suggesting
    // that we're not on a headless display)
    interval = setInterval(() => setCountDown(countDown - 1), 1000);
    window.addEventListener("mousemove", activityListener);
    window.addEventListener("mousedown", activityListener);
    window.addEventListener("keydown", activityListener);

    // we have to clear the interval or else every time we change it, we create
    // another interval on redraw. This return is called when the component
    // unmounts, thus killing the timer (and starting a new one when it draws
    // again I guess).
    return () => clearInterval(interval);
  });

  // navigate away on timeout
  useEffect(() => {
    if (countDown < 0) {
      navigate(`/display`);
    }
  }, [navigate, countDown]);

  return (
    <Box sx={{ padding: "1em" }}>
      <Typography variant="h4" gutterBottom>
        Network Table Top
      </Typography>
      <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
        <Typography variant="h5" gutterBottom>
          Disclaimer
        </Typography>
        <p>
          Network Table Top is not responsible for anything. Close immediately
          or use at your own risk.
        </p>
      </Paper>
      <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
        <Typography variant="h5" gutterBottom>
          Redirecting to Table-Top Display {countDown}
        </Typography>
        <p>
          For convenience on inputless devices, we will start the{" "}
          <b>Table-Top</b> <Link to="/display">display</Link> unless you move
          your mouse or press a key.
        </p>
        <p>
          If you are running a session as a <b>Game Master</b>, you can control
          the table-top display using the <Link to="/edit">editor</Link>.
        </p>
      </Paper>
    </Box>
  );
};

export default LandingComponent;
