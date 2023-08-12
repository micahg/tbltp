import { createRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { loadImage, renderImageFullScreen } from '../../utils/drawing';
import { Rect, fillToAspect, rotate } from '../../utils/geometry';

import styles from './RemoteDisplayComponent.module.css';

const RemoteDisplayComponent = () => {
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const apiUrl: string | undefined = useSelector((state: AppReducerState) => state.environment.api);
  const wsUrl: string | undefined = useSelector((state: AppReducerState) => state.environment.ws);
  const [contentCtx, setContentCtx] = useState<CanvasRenderingContext2D|null>(null);
  const [overlayCtx, setOverlayCtx] = useState<CanvasRenderingContext2D|null>(null);

  useEffect(() => {
    if (!contentCanvasRef.current || contentCtx != null) return;
    setContentCtx(contentCanvasRef.current.getContext('2d', { alpha: false }));
  }, [contentCanvasRef, contentCtx]);

  useEffect(() => {
    if (!overlayCanvasRef.current || overlayCtx != null) return;
    setOverlayCtx(overlayCanvasRef.current.getContext('2d', { alpha: true }));
  }, [overlayCanvasRef, overlayCtx]);

  useEffect(() => {
    if (!overlayCtx) return;
    if (!contentCtx) return;
    if (!wsUrl) {
      console.error('THE OTHER IMPOSSIBLE HAS HAPPENED -- WS MESSAGE WITH NO WS URL WHAT');
      return;
    }

    if ('wakeLock' in navigator) {
      navigator.wakeLock.request("screen").then(() => {
        console.log(`Got wake lock!`);
      }).catch(() => {
        console.error(`Unable to get wakelock`);
      });
    } else {
      console.log('WakeLock unavailable');
    }

    let ws = new WebSocket(wsUrl);
    ws.onopen = (event: Event) => {
      console.log(`Got open event ${JSON.stringify(event)}`);
    };

    ws.onerror = function(ev: Event) {
      console.error(`MICAH got error ${JSON.stringify(ev)}`);
    }

    ws.onmessage = (event) => {
      let data = event.data;
      let js = null;
      try {
        js = JSON.parse(data);
      } catch(e) {
        console.error(`Unable to parse WS message: ${JSON.stringify(data)}`);
        return;
      }

      // ignore null state -- happens when server has no useful state loaded yet
      if (js.state === null) return;

      // if we don't have an API URL we'll never get WS messages... seems impossible
      if (apiUrl === null) {
        console.error('THE IMPOSSIBLE HAS HAPPENED -- WS MESSAGE WITH NO API SERVER WHAT');
        return;
      }

      if (!js.state.viewport) {
        console.error('Unable to render without viewport');
        return;
      }
      let viewport: Rect = js.state.viewport;

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
       * I hate this so much... if someone every does contribute to this
       * project and your js game is better than mine, see if you can make this
       * less isane. The point is to calculate the expanded the selection to
       * fill the screen (based on the aspect ratio of the map) then draw the
       * overlay, then the background. If there is no overlay then just draw
       * background with expanded selection if there is one.
       */
      loadImage(backgroundUri).then(bgImg => {
        let bgVP = fillToAspect(viewport, bgImg.width, bgImg.height);
        if (overlayUri) {
          loadImage(overlayUri).then(ovrImg => {
            /* REALLY IMPORTANT - base overlay on the BG Viewport as it can shift the
             * image. If the zoomed selection is so small that we render negative space
             * (eg beyond the bordres) the viewport shifts to render from the border */
            
            // start assuming no rotation (the easy case)

            // TODO detect portrait - ALL OF THIS CODE assumes editor/overlay are landsacpe
            let [x, y, w, h] = [0, 0, 0, 0]
            if (bgVP.width < bgVP.height) {
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
            renderImageFullScreen(ovrImg, overlayCtx, olVP)
              .then(() => renderImageFullScreen(bgImg, contentCtx, bgVP))
              .catch(err => console.error(`Error rendering background or overlay image: ${JSON.stringify(err)}`));
          }).catch(err => console.error(`Error loading overlay iamge ${overlayUri}: ${JSON.stringify(err)}`));
        } else {
          renderImageFullScreen(bgImg, contentCtx, bgVP)
            .catch(err => console.error(`Error rendering background imager: ${JSON.stringify(err)}`));
        }
      }).catch(err => console.error(`Error loading background image: ${JSON.stringify(err)}`))
    }
  }, [apiUrl, wsUrl, contentCtx, overlayCtx]);

  return (
    <div className={styles.map}>
      <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>Sorry, your browser does not support canvas.</canvas>
      <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef}/>
    </div>
  );
}

export default RemoteDisplayComponent;
