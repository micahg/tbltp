import { createRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { useGetDeviceCodeQuery } from "../../api/auth0";
import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography } from "@mui/material";
import * as QRCode from "qrcode";

const DeviceCodeComponent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const authorized = useSelector(
    (state: AppReducerState) => state.auth.authenticated,
  );

  const [expired, setExpired] = useState<boolean>(false);

  const { data: deviceCode } = useGetDeviceCodeQuery();

  const qrCanvasRef = createRef<HTMLCanvasElement>();

  useEffect(() => {
    dispatch({ type: "environment/devicecode" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Loop around polling for the token (waiting for the device code to be entered)
   */
  useEffect(() => {
    if (!deviceCode) return;

    // periodically trigger polling for the auth
    const intervalId: NodeJS.Timer = setInterval(
      () => dispatch({ type: "environment/devicecodepoll" }),
      1000 * deviceCode?.interval,
    );

    // eventually give up on polling
    const timeoutId: NodeJS.Timer = setTimeout(() => {
      setExpired(true);
      clearInterval(intervalId);
    }, 1000 * deviceCode.expires_in);

    // cancel timers when we're destroyed
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [deviceCode, dispatch]);

  /**
   * Once we're authorized head on back
   */
  useEffect(() => {
    if (!authorized) return;
    navigate("/display");
  }, [navigate, authorized]);

  /**
   * Render the QR code
   */
  useEffect(() => {
    if (!qrCanvasRef.current) return;
    if (!deviceCode) return;

    const canvas: HTMLCanvasElement = qrCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // why 64? IDFK! <paper> padding and margins and just a little extra for safety
    const height = window.innerHeight - rect.top - 64;

    // double the left to ensure we have a semi-centered qr if the width is less than height
    const width = window.innerWidth - 2 * rect.left;
    const size = Math.floor(Math.min(width, height));

    QRCode.toCanvas(
      canvas,
      deviceCode.verification_uri_complete,
      { errorCorrectionLevel: "H", width: size },
      (err) => {
        if (err)
          console.error(`Unable to render QR code: ${JSON.stringify(err)}`);
      },
    );
  }, [deviceCode, qrCanvasRef]);

  return (
    <Box sx={{ padding: "1em" }}>
      <Typography variant="h3" align="center" gutterBottom>
        Network Table Top
      </Typography>
      <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
        <Typography variant="h4" align="center" gutterBottom>
          Authentication Required
        </Typography>
        <br />
        {expired && (
          <Box>
            <Typography variant="h6">
              The request has timed out.
              <br />
              Please refresh and try again.
            </Typography>
            <br />
            <br />
          </Box>
        )}
        {!expired && (
          <Typography variant="body1">
            Please visit{" "}
            {deviceCode ? (
              <a
                target="_blank"
                rel="noreferrer"
                href={deviceCode.verification_uri_complete}
              >
                {deviceCode.verification_uri}
              </a>
            ) : (
              <b>Fetching...</b>
            )}
            <br />
            <br />
            Enter Code{" "}
            <b>{deviceCode ? deviceCode.user_code : "Fetching..."}</b>
            <br />
            <br />
            ... or scan ...
            <br />
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <canvas ref={qrCanvasRef} />
            </Box>
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default DeviceCodeComponent;
