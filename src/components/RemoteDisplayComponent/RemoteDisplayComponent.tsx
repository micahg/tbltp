import { createRef, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { loadImage, renderImageFullScreen } from '../../utils/drawing';
import { Rect, fillToAspect, rotate } from '../../utils/geometry';

import styles from './RemoteDisplayComponent.module.css';
import { useNavigate } from 'react-router-dom';

const RemoteDisplayComponent = () => {
  const navigate = useNavigate();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const apiUrl: string | undefined = useSelector((state: AppReducerState) => state.environment.api);
  const wsUrl: string | undefined = useSelector((state: AppReducerState) => state.environment.ws);
  const authorized: boolean | undefined = useSelector((state: AppReducerState) => state.environment.auth);
  const noauth: boolean = useSelector((state: AppReducerState) => state.environment.noauth);
  const token: string | undefined = useSelector((state: AppReducerState) => state.environment.deviceCodeToken);
  const [contentCtx, setContentCtx] = useState<CanvasRenderingContext2D|null>(null);
  const [overlayCtx, setOverlayCtx] = useState<CanvasRenderingContext2D|null>(null);
  const [connected, setConnected] = useState<boolean|undefined>();
  const [tableData, setTableData] = useState<any>();

  /**
   * Process a websocket message with table data
   * @param data table data
   * @returns nothing
   */
  const processWSMessage = (data: string) => {
    try {
      const js = JSON.parse(data);
      js.tsLocal = Date.now();
      setTableData(js);
    } catch(e) {
      console.error(`Unable to parse WS message - ${JSON.stringify(e)}: ${JSON.stringify(data)}`);
      return;
    }
  }

  /**
   * Render table data
   */
  const processTableData = useCallback((js: any, apiUrl: string, content: CanvasRenderingContext2D, overlay: CanvasRenderingContext2D) => {
    // ignore null state -- happens when server has no useful state loaded yet
    if (js.state === null) return;

    if (!js.state.viewport) {
      console.error('Unable to render without viewport');
      return;
    }
    let viewport: Rect = js.state.viewport;

    if (!js.state.backgroundSize) {
      console.error('Unable to render without background size');
      return;
    }
    let tableBGSize: Rect = js.state.backgroundSize;

    let ts: number = new Date().getTime();
    let overlayUri: string | null = null;
    if ('overlay' in js.state && js.state.overlay) {
      overlayUri = `${apiUrl}/${js.state.overlay}?${ts}`;
    }

    let backgroundUri: string | null = null;
    if ('background' in js.state && js.state.background) {
      backgroundUri = `${apiUrl}/${js.state.background}?${ts}`;
    }

    if (!backgroundUri) {
      console.error(`Unable to determine background URL`);
      return;
    }

    /**
     * I hate this so much... if someone ever does contribute to this
     * project and your js game is better than mine, see if you can make this
     * less isane. The point is to calculate the expanded the selection to
     * fill the screen (based on the aspect ratio of the map) then draw the
     * overlay, then the background. If there is no overlay then just draw
     * background with expanded selection if there is one.
     */
    loadImage(backgroundUri).then(bgImg => {
      const bgVP = fillToAspect(viewport, tableBGSize, bgImg.width, bgImg.height);
      if (overlayUri) {
        loadImage(overlayUri).then(ovrImg => {
          /* REALLY IMPORTANT - base overlay on the BG Viewport as it can shift the
           * image. If the zoomed selection is so small that we render negative space
           * (eg beyond the bordres) the viewport shifts to render from the border */
          
          // start assuming no rotation (the easy case)

          // TODO detect portrait - ALL OF THIS CODE assumes editor/overlay are landsacpe
          let [x, y, w, h] = [0, 0, 0, 0]
          if (bgImg.width < bgImg.height) {
            [x, y] = rotate(90, bgVP.x, bgVP.y, bgImg.width,
                            bgImg.height);
            let [x2, y2] = rotate(90, bgVP.x + bgVP.width, bgVP.y + bgVP.height,
                                  bgImg.width, bgImg.height);
            [x, x2] = [Math.min(x, x2), Math.max(x, x2)];
            [y, y2] = [Math.min(y, y2), Math.max(y, y2)];
            w = x2 - x;
            h = y2 - y;
            let scale = ovrImg.width/bgImg.height;
            x *= scale;
            y *= scale;
            w *= scale;
            h *= scale;
          } else {
            let scale = bgImg.width/ovrImg.width;
            x = bgVP.x / scale;
            y = bgVP.y / scale;
            w = bgVP.width / scale;
            h = bgVP.height / scale;
          }
          let olVP = {x: x, y: y, width: w, height: h};
          renderImageFullScreen(ovrImg, overlay, olVP)
            .then(() => renderImageFullScreen(bgImg, content, bgVP))
            .catch(err => console.error(`Error rendering background or overlay image: ${JSON.stringify(err)}`));
        }).catch(err => console.error(`Error loading overlay iamge ${overlayUri}: ${JSON.stringify(err)}`));
      } else {
        renderImageFullScreen(bgImg, content, bgVP)
          .catch(err => console.error(`Error rendering background imager: ${JSON.stringify(err)}`));
      }
    }).catch(err => console.error(`Error loading background image: ${JSON.stringify(err)}`));
  }, []);

  useEffect(() => {
    if (!contentCanvasRef.current || contentCtx != null) return;
    setContentCtx(contentCanvasRef.current.getContext('2d', { alpha: false }));
  }, [contentCanvasRef, contentCtx]);

  useEffect(() => {
    if (!overlayCanvasRef.current || overlayCtx != null) return;
    setOverlayCtx(overlayCanvasRef.current.getContext('2d', { alpha: true }));
  }, [overlayCanvasRef, overlayCtx]);

  /**
   * First settle our authentication situation. Either confirm we are running
   * without authentication or go get authenticated. When this settles, we'll
   * trigger connection with the server.
   */
  useEffect(() => {
    // don't punt until we have successfully hit the server
    if (authorized === undefined) return navigate(`/connectionerror`);

    // if authorization is ON and we are not authorized, redirect
    if (!noauth && !authorized) return navigate(`/device`);

    // having authorized for the first time, start the connection loop
    setConnected(false);
  }, [authorized, noauth, navigate])

  /**
   * When authentication is sorted, figure out connectivity
   */
  useEffect(() => {
    if (connected === undefined) return;
    if (connected) return;

    let timer: NodeJS.Timer;

    const scheduleConnection = (cause: string) => {
      console.log(`Connection ${cause}`);
      if (timer === undefined) {
        setConnected(undefined);
        console.log(`Setting retry timer (${cause})...`);
        timer = setInterval(() => setConnected(false), 1000);
        console.log(`Timer set to ${timer}`);
      }
    }

    const fullUrl = noauth ? `${wsUrl}` : `${wsUrl}?bearer=${token}`;
    let ws = new WebSocket(fullUrl);
    console.log('Attempting connection');
    ws.onclose = (event: Event) => scheduleConnection('closed');
    ws.onerror = (event: Event) => scheduleConnection('error');
    ws.onmessage = (event: MessageEvent) => processWSMessage(event.data);
    ws.onopen = (event: Event) => console.log('Connection established');
  }, [apiUrl, contentCtx, overlayCtx, connected, noauth, token, wsUrl])

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
      <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>Sorry, your browser does not support canvas.</canvas>
      <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef}/>
    </div>
  );
}

export default RemoteDisplayComponent;
