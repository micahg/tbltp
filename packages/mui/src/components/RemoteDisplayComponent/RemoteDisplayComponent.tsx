import { createRef, useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

import styles from "./RemoteDisplayComponent.module.css";
import { useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { setupOffscreenCanvas } from "../../utils/offscreencanvas";
import { debounce } from "lodash";
import { HydratedTokenInstance, Rect, TableState } from "@micahg/tbltp-common";

interface WSStateMessage {
  method?: string;
  info?: string;
  state?: TableState;
  tsLocal?: number;
}

interface InternalState {
  transferred: boolean;
}

const RemoteDisplayComponent = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const [internalState] = useState<InternalState>({
    transferred: false,
  });
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

  const mediaPrefix = useSelector(
    (state: AppReducerState) => state.content.mediaPrefix,
  );
  const [connected, setConnected] = useState<boolean | undefined>();
  const [tableData, setTableData] = useState<WSStateMessage>();
  const [authTimer, setAuthTimer] = useState<NodeJS.Timer>();
  const [wsTimer, setWSTimer] = useState<NodeJS.Timer>();
  const [serverInfo, setServerInfo] = useState<string>();
  const [worker, setWorker] = useState<Worker>();

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
        else if (js.info === "INVALID_SCENE_TOKEN_LENGTH")
          setServerInfo(
            "Invalid scene tokens - Asset or token likely deleted after being placed in current scene 💀",
          );
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
   *
   * TODO decouple setup (canvases, etc) from table state updates!  worker shouldn't be a dep of the setup routine
   */
  const processTableData = useCallback(
    (js: WSStateMessage, apiUrl: string, bearer: string) => {
      if (!dispatch) return;
      if (!mediaPrefix) return;

      if (!worker) {
        console.error(`Received state before worker ready`);
        return;
      }
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

      const angle = js.state.angle || 0;

      let overlay: string | undefined;
      if ("overlay" in js.state && js.state.overlay) {
        overlay = `${apiUrl}/${js.state.overlay}`;
      }

      let background: string | null = null;
      if ("background" in js.state && js.state.background) {
        background = `${apiUrl}/${js.state.background}`;
      }

      if (!background) {
        console.error(`Unable to determine background URL`);
        return;
      }

      let tokens: HydratedTokenInstance[] = [];
      if ("tokens" in js.state && js.state.tokens) {
        tokens = js.state.tokens;
      }
      for (const token of tokens) {
        token.asset = `${mediaPrefix}/${token.asset}`;
      }
      const things: (HydratedTokenInstance | Rect)[] =
        tokens.length > 0 ? [...tokens] : [];

      const backgroundRev = js.state.backgroundRev;
      const overlayRev = js.state.overlayRev;

      // update the images/viewport
      worker.postMessage({
        cmd: "update",
        values: {
          background,
          backgroundRev,
          overlay,
          overlayRev,
          viewport,
          bearer,
          angle,
          things,
        },
      });
    },
    [dispatch, mediaPrefix, worker],
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
  }, []);

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

    // if auth is off this should (in the middleware/auth code) force the token to NOAUTH
    if (noauth)
      dispatch({
        type: "environment/devicecodepoll",
      });

    // having authorized for the first time, start the connection loop
    setConnected(false);
  }, [authorized, noauth, navigate, authTimer, dispatch]);

  /**
   * When authentication is sorted, figure out connectivity
   */
  useEffect(() => {
    if (connected === undefined) return;
    if (connected) return;
    if (!token) return;
    if (!wsUrl) return;

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
    ws.onclose = () => scheduleConnection();
    ws.onerror = () => ws.close();
    ws.onopen = () => {
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
  }, [connected, noauth, token, wsUrl, wsTimer]);

  useEffect(() => {
    const bg = contentCanvasRef.current;
    const ov = overlayCanvasRef.current;
    if (!ov || !bg || internalState.transferred) return;
    const wrkr = setupOffscreenCanvas(bg, ov);
    setWorker(wrkr);
    internalState.transferred = true;
    const handleResizeEvent = debounce(async (e: ResizeObserverEntry[]) => {
      const [w, h] = [e[0].contentRect.width, e[0].contentRect.height];
      if (w === 0 && h === 0) return; // when the component is hidden or destroyed
      if (wrkr) wrkr.postMessage({ cmd: "resize", width: w, height: h });
      else console.warn(`Resize event before web worker created`);
    }, 250);
    const observer = new ResizeObserver((e) => handleResizeEvent(e));
    observer.observe(ov);
  }, [overlayCanvasRef, contentCanvasRef, internalState]);

  /**
   * With all necessary components and some table data, trigger drawing
   */
  useEffect(() => {
    if (!worker || !apiUrl || !tableData || !token) return;
    console.log(tableData);
    processTableData(tableData, apiUrl, token);
  }, [apiUrl, tableData, token, processTableData, worker]);

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
