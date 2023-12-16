import { createRef, useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { loadImage, renderViewPort } from "../../utils/drawing";
import {
  Rect,
  getWidthAndHeight,
  fillRotatedViewport,
} from "../../utils/geometry";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

import styles from "./RemoteDisplayComponent.module.css";
import { useNavigate } from "react-router-dom";
import { Box } from "@mui/material";

/**
 * Table state sent to display client by websocket. A partial Scene.
 */
export interface TableState {
  overlay?: string;
  background?: string;
  viewport: Rect;
  angle: number;
  backgroundSize?: Rect;
}

interface WSStateMessage {
  method?: string;
  info?: string;
  state?: TableState;
  tsLocal?: number;
}

const RemoteDisplayComponent = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const apiUrl: string | undefined = useSelector(
    (state: AppReducerState) => state.environment.api,
  );
  const wsUrl: string | undefined = useSelector(
    (state: AppReducerState) => state.environment.ws,
  );
  const authorized: boolean | undefined = useSelector(
    (state: AppReducerState) => state.environment.auth,
  );
  const noauth: boolean = useSelector(
    (state: AppReducerState) => state.environment.noauth,
  );
  const token: string | undefined = useSelector(
    (state: AppReducerState) => state.environment.deviceCodeToken,
  );
  const [contentCtx, setContentCtx] = useState<CanvasRenderingContext2D | null>(
    null,
  );
  const [overlayCtx, setOverlayCtx] = useState<CanvasRenderingContext2D | null>(
    null,
  );
  const [connected, setConnected] = useState<boolean | undefined>();
  const [tableData, setTableData] = useState<WSStateMessage>();
  const [authTimer, setAuthTimer] = useState<NodeJS.Timer>();
  const [wsTimer, setWSTimer] = useState<NodeJS.Timer>();
  const [serverInfo, setServerInfo] = useState<string>();

  /**
   * Process a websocket message with table data
   * @param data table data
   * @returns nothing
   */
  const processWSMessage = (data: string) => {
    try {
      const js: WSStateMessage = JSON.parse(data);
      js.tsLocal = Date.now();
      if (js.method === "error") {
        if (js.info === "NO_SCENE")
          setServerInfo(
            "No scene information. Please ask your GM to set a background and send and update",
          );
        else if (js.info === "INVALID_TOKEN")
          setServerInfo("Invalid token refresh and login");
        else if (js.info === "INVALID_USER")
          setServerInfo("Invalid user - please ask your GM to sign in");
        else if (js.info)
          setServerInfo(`Please contact support - Unkown error: ${js.info}`);
      } else {
        setServerInfo(undefined);
        setTableData(js);
      }
    } catch (e) {
      console.error(
        `Unable to parse WS message - ${JSON.stringify(e)}: ${JSON.stringify(
          data,
        )}`,
      );
      return;
    }
  };

  /**
   * Render table data
   */
  const processTableData = useCallback(
    (
      js: WSStateMessage,
      apiUrl: string,
      content: CanvasRenderingContext2D,
      overlay: CanvasRenderingContext2D,
    ) => {
      // ignore null state -- happens when server has no useful state loaded yet
      if (!js.state) return;

      if (!js.state.viewport) {
        console.error("Unable to render without viewport");
        return;
      }
      const viewport: Rect = js.state.viewport;

      if (!js.state.backgroundSize) {
        console.error("Unable to render without background size");
        return;
      }
      const tableBGSize: Rect = js.state.backgroundSize;

      const angle = js.state.angle || 0;

      const ts: number = new Date().getTime();
      let overlayUri: string | null = null;
      if ("overlay" in js.state && js.state.overlay) {
        overlayUri = `${apiUrl}/${js.state.overlay}?${ts}`;
      }

      let backgroundUri: string | null = null;
      if ("background" in js.state && js.state.background) {
        backgroundUri = `${apiUrl}/${js.state.background}?${ts}`;
      }

      if (!backgroundUri) {
        console.error(`Unable to determine background URL`);
        return;
      }

      // const screen = getWidthAndHeight();
      const [width, height] = getWidthAndHeight();
      content.canvas.width = width;
      content.canvas.height = height;
      content.canvas.style.width = `${width}px`;
      content.canvas.style.height = `${height}px`;
      overlay.canvas.width = width;
      overlay.canvas.height = height;
      overlay.canvas.style.width = `${width}px`;
      overlay.canvas.style.height = `${height}px`;

      /**
       * I hate this so much... if someone ever does contribute to this
       * project and your js game is better than mine, see if you can make this
       * less isane. The point is to calculate the expanded the selection to
       * fill the screen (based on the aspect ratio of the map) then draw the
       * overlay, then the background. If there is no overlay then just draw
       * background with expanded selection if there is one.
       */
      loadImage(backgroundUri)
        .then((bgImg) => {
          // the untainted one is not dealing with the silkScale (more on that in geometry.ts)
          // since we can safely assume (for now) that the overlay isn't downscaled due to
          // memory constraints, then we can get our ratios using the intended background size
          // instead of the actual
          // const bgVPnoTaint = fillToAspect(viewport, tableBGSize, tableBGSize.width, tableBGSize.height);
          // const bgVP = fillToAspect(viewport, tableBGSize, bgImg.width, bgImg.height);
          const oDimensions = [tableBGSize.width, tableBGSize.height];
          const bgVP = fillRotatedViewport(
            [width, height],
            [bgImg.width, bgImg.height],
            oDimensions,
            angle,
            viewport,
          );
          if (overlayUri) {
            loadImage(overlayUri)
              .then((ovrImg) => {
                const ovVP = fillRotatedViewport(
                  [width, height],
                  [ovrImg.width, ovrImg.height],
                  oDimensions,
                  angle,
                  viewport,
                );
                renderViewPort(overlay, ovrImg, angle, ovVP);
                renderViewPort(content, bgImg, angle, bgVP);
              })
              .catch((err) =>
                console.error(
                  `Error loading overlay image ${overlayUri}: ${JSON.stringify(
                    err,
                  )}`,
                ),
              );
          } else {
            renderViewPort(content, bgImg, angle, bgVP);
          }
        })
        .catch((err) =>
          console.error(
            `Error loading background image: ${JSON.stringify(err)}`,
          ),
        );
    },
    [],
  );

  /**
   * Get the wakelock -- don't worry about forcing release.
   * Its automatic when tabbed out or switched.
   */
  const doFocus = () => {
    navigator.wakeLock
      .request("screen")
      .then((sentinal) => {
        sentinal.addEventListener("release", () =>
          console.log("wakelock released"),
        );
        console.log(`Got wake lock!`);
      })
      .catch((err) =>
        console.error(`Unable to get wakelock: ${JSON.stringify(err)}`),
      );
  };

  useEffect(() => {
    if (!contentCanvasRef.current || contentCtx != null) return;
    setContentCtx(contentCanvasRef.current.getContext("2d", { alpha: false }));
  }, [contentCanvasRef, contentCtx]);

  useEffect(() => {
    if (!overlayCanvasRef.current || overlayCtx != null) return;
    setOverlayCtx(overlayCanvasRef.current.getContext("2d", { alpha: true }));
  }, [overlayCanvasRef, overlayCtx]);

  /**
   * Things learned the ... difficult way ... we do not need to really cleanup
   * the wakelock - when the tab is switched out or closed it gets released.
   * This is so on chrome anyway. For this reason, we don't have a blur event
   * since the WakeLockSentinel would be null having already been released.
   */
  useEffect(() => {
    if ("wakeLock" in navigator) {
      // on silk the focus event never fires so doFocus anyway - so you have
      // two wakelocks -- what could go wrong!?
      doFocus();
      window.addEventListener("focus", doFocus);
      return () => window.removeEventListener("focus", doFocus);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * First settle our authentication situation. Either confirm we are running
   * without authentication or go get authenticated. When this settles, we'll
   * trigger connection with the server.
   */
  useEffect(() => {
    // if we are in an undetermined authorized state it means we couldn't
    // connect to the API to get ANY auth config so start an interval to
    // retry
    if (authorized === undefined) {
      const timer = setInterval(
        () => dispatch({ type: "environment/config", payload: undefined }),
        5000,
      );
      setAuthTimer(timer);
      return () => clearInterval(timer); // this is how you avoid the two-timer fuckery with strict mode
    }

    // if we've passed rendering once and have a timer we can stop it now that
    // we have authentication configuration
    if (authTimer) clearInterval(authTimer);

    // if authorization is ON and we are not authorized, redirect
    if (!noauth && !authorized) return navigate(`/device`);

    // having authorized for the first time, start the connection loop
    setConnected(false);
  }, [authorized, noauth, navigate, authTimer, dispatch]);

  /**
   * When authentication is sorted, figure out connectivity
   */
  useEffect(() => {
    if (connected === undefined) return;
    if (connected) return;

    const scheduleConnection = () => {
      console.log(`Connection closed`);
      setConnected(undefined);
      const timer = setTimeout(() => setConnected(false), 1000);
      setWSTimer(timer);
    };

    const fullUrl = noauth ? `${wsUrl}` : `${wsUrl}?bearer=${token}`;
    const ws = new WebSocket(fullUrl);
    console.log("Attempting websocket connection");
    ws.onmessage = (event: MessageEvent) => processWSMessage(event.data);
    ws.onclose = (event: Event) => scheduleConnection();
    ws.onerror = (event: Event) => ws.close();
    ws.onopen = (event: Event) => {
      if (wsTimer) {
        clearTimeout(wsTimer);
        setWSTimer(undefined);
      }
      if (!connected) setConnected(true);
      console.log("Websocket connection established");
    };

    return () => {
      if (wsTimer) clearTimeout(wsTimer);
    };
  }, [
    apiUrl,
    contentCtx,
    overlayCtx,
    connected,
    noauth,
    token,
    wsUrl,
    wsTimer,
  ]);

  /**
   * With all necessary components and some table data, trigger drawing
   */
  useEffect(() => {
    if (!overlayCtx) return;
    if (!contentCtx) return;
    if (!apiUrl) return;
    if (!tableData) return;

    processTableData(tableData, apiUrl, contentCtx, overlayCtx);
  }, [contentCtx, overlayCtx, apiUrl, tableData, processTableData]);

  return (
    <div className={styles.map}>
      <Stack>
        <Box sx={{ zIndex: 3, padding: "1em" }}>
          {authorized === undefined && (
            <Alert severity="error">
              Unable to get authentication configuration... reattempting...
            </Alert>
          )}
          {authorized !== undefined &&
            serverInfo === undefined &&
            !connected && (
              <Alert severity="error">
                Unable to connect... reattempting...
              </Alert>
            )}
          {authorized !== undefined && serverInfo !== undefined && (
            <Alert severity="error">{serverInfo}</Alert>
          )}
        </Box>
      </Stack>
      <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>
        Sorry, your browser does not support canvas.
      </canvas>
      <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef} />
    </div>
  );
};

export default RemoteDisplayComponent;
