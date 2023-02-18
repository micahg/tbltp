import { createRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { loadImage, renderImage, setupOverlayCanvas } from '../../utils/drawing';

import styles from './RemoteDisplayComponent.module.css';

interface RemoteDisplayComponentProps {}

const RemoteDisplayComponent = () => {
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const [overlayURI, setOverlayURI] = useState<string|null>(null);
  const apiUrl: string | undefined = useSelector((state: AppReducerState) => state.environment.api);

  useEffect(() => {
    const overlayCnvs = overlayCanvasRef.current;
    if (!overlayCnvs) {
      // TODO SIGNAL ERROR
      console.error(`Unable to get overlay canvas ref`)
      return;
    }

    const overlayCtx = overlayCnvs.getContext('2d', {alpha: true})
    if (!overlayCtx) {
      // TODO SIGNAL ERROR
      console.error('Unable to get overlay canvas context')
      return;
    }

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

      if ('overlay' in js && apiUrl) {
        let ts: number = new Date().getTime();
        loadImage(`${apiUrl}/${js.overlay}?${ts}`).then((img: HTMLImageElement) => {
          renderImage(img, overlayCnvs, overlayCtx);
        }).catch(err => {
          console.error(err);
        });
      }
    }
  });

  return (
    <div className={styles.map}>
      Hey Bud!
      <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>Sorry, your browser does not support canvas.</canvas>
      <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef}/>
    </div>
  );
}

export default RemoteDisplayComponent;
