import { createRef, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography } from "@mui/material";
import * as QRCode from "qrcode";
import { useGetAuthConfigQuery } from "../../api/environment";
import {
  useGetDeviceAuthStateQuery,
  useGetDeviceCodeMutation,
  usePollDeviceCodeMutation,
} from "../../api/devicecode";

const DeviceCodeComponent = () => {
  const navigate = useNavigate();

  const { data: authState } = useGetDeviceAuthStateQuery();
  const { data: authConfig } = useGetAuthConfigQuery();
  const [getDeviceCode] = useGetDeviceCodeMutation();
  const [pollDeviceCode] = usePollDeviceCodeMutation();
  const startedRef = useRef<boolean>(false);
  const deviceCode = authState?.deviceCode;
  const authorized = authState?.authorized ?? false;

  // note, the next two can be dubious -- deviceCode is called twice in strict mode, which means the overall
  // object changes -- we rely on the fact that the polling/expiration values dont change.
  const deviceCodeInterval = deviceCode?.interval;
  const deviceCodeExpiry = deviceCode?.expires_in;
  const deviceCodeFullUrl = deviceCode?.verification_uri_complete;

  const [expired, setExpired] = useState<boolean>(false);

  const qrCanvasRef = createRef<HTMLCanvasElement>();

  useEffect(() => {
    if (!authConfig) return;
    if (deviceCode) return;
    if (authorized) return;
    if (startedRef.current) return;

    startedRef.current = true;

    getDeviceCode(authConfig)
      .unwrap()
      .catch((err) => {
        startedRef.current = false;
        console.error(
          `Device Code Authentication Failed: ${JSON.stringify(err)}`,
        );
      });
  }, [authConfig, deviceCode, authorized, getDeviceCode]);

  useEffect(() => {
    setExpired(false);
  }, [deviceCode?.device_code]);

  /**
   * Loop around polling for the token (waiting for the device code to be entered)
   */
  useEffect(() => {
    if (!deviceCodeInterval || !deviceCodeExpiry) return;

    // periodically trigger polling for the auth
    const intervalId = window.setInterval(
      () => void pollDeviceCode({ noauth: false, deviceCode }),
      1000 * deviceCodeInterval,
    );

    // eventually give up on polling
    const timeoutId = window.setTimeout(() => {
      setExpired(true);
      clearInterval(intervalId);
    }, 1000 * deviceCodeExpiry);

    // cancel timers when we're destroyed
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [deviceCodeInterval, deviceCodeExpiry, deviceCode, pollDeviceCode]);

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
    if (!deviceCodeFullUrl) return;

    const canvas: HTMLCanvasElement = qrCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // why 64? IDFK! <paper> padding and margins and just a little extra for safety
    const height = window.innerHeight - rect.top - 64;

    // double the left to ensure we have a semi-centered qr if the width is less than height
    const width = window.innerWidth - 2 * rect.left;
    const size = Math.floor(Math.min(width, height));

    QRCode.toCanvas(
      canvas,
      deviceCodeFullUrl,
      { errorCorrectionLevel: "H", width: size },
      (err) => {
        if (err)
          console.error(`Unable to render QR code: ${JSON.stringify(err)}`);
      },
    );
  }, [deviceCodeFullUrl, qrCanvasRef]);

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
          <Typography variant="body1" align="center">
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
            <canvas ref={qrCanvasRef} />
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default DeviceCodeComponent;
