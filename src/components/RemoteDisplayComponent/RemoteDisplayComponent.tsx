import { createRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { loadImage, renderImage } from '../../utils/drawing';
import { Rect, fillToAspect } from '../../utils/geometry';

import styles from './RemoteDisplayComponent.module.css';

const RemoteDisplayComponent = () => {
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const apiUrl: string | undefined = useSelector((state: AppReducerState) => state.environment.api);
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

    // TODO FIX THIS FIRST YIKES
    let url = `ws://localhost:3000/`;
    let ws = new WebSocket(url);
    ws.onopen = (event: Event) => {
      console.log(`MICAH got open event ${JSON.stringify(event)}`);
      ws.send('hello');
      return "";
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
      loadImage(backgroundUri)
        .then(bgImg => {
          let bgVP = fillToAspect(viewport, bgImg.width, bgImg.height);
          if (overlayUri) {
            loadImage(overlayUri).then(ovrImg => {
              // need to scale the selection down to the canvas size of the overlay
              // which (typically) considerably smaller than the background image
              let scale = bgImg.width/ovrImg.width;
              let olVP = {x: viewport.x/scale, y: viewport.y/scale, width: viewport.width/scale, height: viewport.height/scale};
              olVP = fillToAspect(olVP, ovrImg.width, ovrImg.height);
              renderImage(ovrImg, overlayCtx, true, false, olVP)
                .then(() => renderImage(bgImg, contentCtx, true, false, bgVP))
                .catch(err => console.error(`Error rendering background or overlay image: ${JSON.stringify(err)}`));
            }).catch(err => console.error(`Error loading overlay iamge ${overlayUri}: ${JSON.stringify(err)}`));
          } else {
            renderImage(bgImg, contentCtx, true, false, viewport)
              .catch(err => console.error(`Error rendering background imager: ${JSON.stringify(err)}`));
          }
        }).catch(err => console.error(`Error loading background image: ${JSON.stringify(err)}`))

    }
  }, [contentCtx, overlayCtx]);

  return (
    <div className={styles.map}>
      <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>Sorry, your browser does not support canvas.</canvas>
      <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef}/>
    </div>
  );
}

export default RemoteDisplayComponent;
