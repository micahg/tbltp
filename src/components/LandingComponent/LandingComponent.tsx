import { useEffect, useState } from 'react';
import { Box, Paper, Typography  } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface LandingComponentProps {}

const LandingComponent = (props: LandingComponentProps) => {
  const [countDown, setCountDown] = useState<number>(5);
  const navigate = useNavigate();

  useEffect(() => {
    // start counting down every second
    const interval = setInterval(() => setCountDown(countDown - 1), 1000);

    // we have to clear the interval or else every time we change it, we create
    // another interval on redraw. This return is called when the component
    // unmounts, thus killing the timer (and starting a new one when it draws
    // again I guess).
    return () => clearInterval(interval);
  });

  // navigate away on timeout
  useEffect(() => {
    if (countDown < 0) {
      navigate(`display`);
    }
  }, [navigate, countDown]);


  return (
    <Box sx={{height: '100vh', width: '100%', padding: '1em'}}>
      <Typography variant="h4" gutterBottom>Network Table Top</Typography>
      <Paper sx={{padding: '1em', margin: '1em 0'}}>
        <Typography variant="h5" gutterBottom>Disclaimer</Typography>
        <p>Network Table Top is not responsible for anything. Close immeditaly or use at your own risk.</p>
      </Paper>
      <Paper sx={{padding: '1em', margin: '1em 0'}}>
        <Typography variant="h5" gutterBottom>Redirecting to remote display {countDown}</Typography>
        <p>For convenience we will redirect to the remote <a href="/display">display</a> mode shortly!</p>
        <p>Click <a href="/edit">here</a> to use the editor instead.</p>
      </Paper>
    </Box>
  );
};

export default LandingComponent;
