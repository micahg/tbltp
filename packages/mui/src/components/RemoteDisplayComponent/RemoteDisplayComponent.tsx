import { createRef, useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { renderViewPort } from "../../utils/drawing";
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
import { setupOffscreenCanvas } from "../../utils/offscreencanvas";

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

// TODO UNION MICAH DON"T SKIP NOW
export type TableUpdate = TableState & {
  bearer: string;
};

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
  const fullCanvasRef = createRef<HTMLCanvasElement>();
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
  // TODO REMOVE THESE CONTEXTS?
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
  const [canvassesTransferred, setCanvassesTransferred] =
    useState<boolean>(false); // avoid transfer errors
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

  // TODO this doesn't seem to have dependencies, why are we using a callback?
  const handleWorkerMessage = useCallback((evt: MessageEvent<unknown>) => {
    // bump the overlay version so it gets sent
    if (!evt.data || typeof evt.data !== "object") return;
    if (!("cmd" in evt.data)) return;
    if (evt.data.cmd === "initialized") {
      if (!("width" in evt.data) || typeof evt.data.width !== "number") {
        console.error("Invalid width in worker initialized message");
        return;
      }
      if (!("height" in evt.data) || typeof evt.data.height !== "number") {
        console.error("Invalid height in worker initialized message");
        return;
      }
      if (
        !("fullWidth" in evt.data) ||
        typeof evt.data.fullWidth !== "number"
      ) {
        console.error("Invalid fullWidth in worker initialized message");
        return;
      }
      if (
        !("fullHeight" in evt.data) ||
        typeof evt.data.fullHeight !== "number"
      ) {
        console.error("Invalid fullHeight in worker initialized message");
        return;
      }
      // setViewportSize([evt.data.width, evt.data.height]);
      // setImageSize([evt.data.fullWidth, evt.data.fullHeight]);
    }
    /* else if (evt.data.cmd === "pan_complete") {
      // after panning is done, we can go back to waiting state
      sm.transition("wait");
    } else if (evt.data.cmd === "select_complete") {
      if ("rect" in evt.data) setSelection(evt.data.rect as unknown as Rect);
      else console.error(`No rect in ${evt.data.cmd}`);
    } else if (evt.data.cmd === "progress") {
      if ("evt" in evt.data) {
        const e = evt.data.evt as LoadProgress;

        // on complete (progress of 1) remove the download
        if (e.progress === 1) delete downloads[e.img];
        else downloads[e.img] = e.progress;

        // with nothing left we're fully loaded
        const length = Object.keys(downloads).length;
        if (length === 0) return setDownloadProgress(100);

        // otherwise, tally the totals and set progress
        let value = 0;
        for (const [, v] of Object.entries(downloads)) value += v;
        setDownloadProgress((value * 100) / length);
      }
    }*/
  }, []);

  /**
   * Render table data
   */
  const processTableData = useCallback(
    (
      js: WSStateMessage,
      apiUrl: string,
      contentCanvas: HTMLCanvasElement,
      overlayCanvas: HTMLCanvasElement,
      fullCanvas: HTMLCanvasElement,
      bearer: string,
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
      let overlay: string | undefined;
      if ("overlay" in js.state && js.state.overlay) {
        overlay = `${apiUrl}/${js.state.overlay}?${ts}`;
      }

      let background: string | null = null;
      if ("background" in js.state && js.state.background) {
        background = `${apiUrl}/${js.state.background}?${ts}`;
      }

      if (!background) {
        console.error(`Unable to determine background URL`);
        return;
      }

      const [width, height] = getWidthAndHeight();
      setCanvassesTransferred(true);
      if (!canvassesTransferred) {
        const wrkr = setupOffscreenCanvas(
          bearer,
          contentCanvas,
          overlayCanvas,
          fullCanvas,
          canvassesTransferred,
          angle,
          width,
          height,
          background,
          overlay,
          viewport,
        );
        setWorker(wrkr);
        wrkr.onmessage = handleWorkerMessage;
      } else if (worker) {
        // update the images/viewport
        worker.postMessage({
          cmd: "update",
          values: {
            background,
            overlay,
            viewport,
            bearer,
            angle,
          },
        });
      }
    },
    [canvassesTransferred, handleWorkerMessage],
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

  // useEffect(() => {
  //   if (!contentCanvasRef.current || contentCtx != null) return;
  //   setContentCtx(contentCanvasRef.current.getContext("2d", { alpha: false }));
  // }, [contentCanvasRef, contentCtx]);

  // useEffect(() => {
  //   if (!overlayCanvasRef.current || overlayCtx != null) return;
  //   setOverlayCtx(overlayCanvasRef.current.getContext("2d", { alpha: true }));
  // }, [overlayCanvasRef, overlayCtx]);

  // useEffect(() => {
  //   const content = contentCanvasRef.current;
  //   const overlay = overlayCanvasRef.current;
  //   const full = fullCanvasRef.current;
  //   if (!content || !overlay || !full) return;
  //   if (!token) return;
  //   const [width, height] = getWidthAndHeight();

  //   content.width = width;
  //   content.height = height;
  //   content.style.width = `${width}px`;
  //   content.style.height = `${height}px`;
  //   overlay.width = width;
  //   overlay.height = height;
  //   overlay.style.width = `${width}px`;
  //   overlay.style.height = `${height}px`;

  //   // henceforth canvas is transferred -- this doesn't take effect until the next render
  //   // so the on this pass it is false when passed to setCanvassesTransferred even if set
  //   setCanvassesTransferred(true);
  //   const wrkr = setupOffscreenCanvas(
  //     token,
  //     content,
  //     overlay,
  //     full,
  //     canvassesTransferred,
  //     0,
  //     width,
  //     height,
  //     bgUrl,
  //     ovUrl,
  //   );
  //   setWorker(wrkr);
  //   wrkr.onmessage = handleWorkerMessage;
  // }, [overlayCanvasRef, contentCanvasRef, fullCanvasRef]);

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
  }, [connected, noauth, token, wsUrl, wsTimer]);

  /**
   * With all necessary components and some table data, trigger drawing
   */
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    if (!contentCanvasRef.current) return;
    if (!fullCanvasRef.current) return;
    if (!apiUrl) return;
    if (!tableData) return;
    if (!token) return;

    console.log(tableData);
    processTableData(
      tableData,
      apiUrl,
      contentCanvasRef.current,
      overlayCanvasRef.current,
      fullCanvasRef.current,
      token,
    );
  }, [
    contentCanvasRef,
    overlayCanvasRef,
    fullCanvasRef,
    apiUrl,
    tableData,
    token,
    processTableData,
  ]);

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
      <canvas hidden ref={fullCanvasRef} />
    </div>
  );
};

export default RemoteDisplayComponent;
