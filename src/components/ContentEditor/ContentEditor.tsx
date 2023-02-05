import { createRef, useEffect } from 'react';
import { IMG_URI, loadImage, obscureOverlay, renderImage, setupOverlayCanvas, selectOverlay, storeOverlay} from '../../utils/drawing';
import { transitionStateMachine, StateMachine } from '../../utils/statemachine';
import { MouseStateMachine } from '../../utils/mousestatemachine';
import styles from './ContentEditor.module.css';

interface ContentEditorProps {}

const ContentEditor = () => {

  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const obscureButtonRef = createRef<HTMLButtonElement>();
  const sm = new MouseStateMachine();

  useEffect(() => {
    const contentCnvs = contentCanvasRef.current;
    if (!contentCnvs) {
      // TODO SIGNAL ERROR
      console.error(`Unable to get content canvas ref`);
      return;
    }

    const overlayCnvs = overlayCanvasRef.current;
    if (!overlayCnvs) {
      // TODO SIGNAL ERROR
      console.error(`Unable to get overlay canvas ref`)
      return;
    }

    const contentCtx = contentCnvs.getContext('2d', { alpha: false });
    if (!contentCtx) {
      // TODO SIGNAL ERROR
      console.error(`Unable to get content canvas context`);
      return;
    }

    const overlayCtx = overlayCnvs.getContext('2d', {alpha: true})
    if (!overlayCtx) {
      // TODO SIGNAL ERROR
      console.error('Unable to get overlay canvas context')
      return;
    }

    sm.setMoveCallback(selectOverlay.bind(overlayCtx));
    sm.setStartCallback(storeOverlay.bind(overlayCtx));
    sm.setSelectedCallback((x1, y1, x2, y2) => {
      if (obscureButtonRef.current) {
        obscureButtonRef.current.onclick = function() {
          obscureOverlay.bind(overlayCtx)(x1, y1, x2, y2);
          if (obscureButtonRef.current) {
            obscureButtonRef.current.onclick = null;
            obscureButtonRef.current.disabled = true;
          }
        }
        obscureButtonRef.current.disabled = false;
      } else {
        // TODO SIGNAL ERROR
        console.error('Unable to get ')
      }
    });

    const obscureButton = obscureButtonRef.current;
    if (!obscureButton) {
      // TODO SIGNAL ERROR
      console.error('Unable to get obscure button');
      return;
    }

    loadImage(IMG_URI)
      .then(img => renderImage(img, contentCnvs, contentCtx))
      .then(() => setupOverlayCanvas(contentCnvs, overlayCnvs, overlayCtx))
      .then(() => {
        overlayCnvs.addEventListener('mousedown', (evt: MouseEvent) => sm.transition('down', evt));
        overlayCnvs.addEventListener('mouseup', (evt: MouseEvent) => sm.transition('up', evt));
        overlayCnvs.addEventListener('mousemove', (evt: MouseEvent) => sm.transition('move', evt));
      })
      .catch(err => {
        // TODO SIGNAL ERROR
        console.log(`Unable to load image: ${JSON.stringify(err)}`);
      });
  });

  return (
    <div className={styles.ContentEditor} data-testid="ContentEditor">
      <div className={styles.ContentContainer} data-testid="RemoteDisplayComponent">
        <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>Sorry, your browser does not support canvas.</canvas>
        <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef}/>
      </div>
      <div className={styles.ControlsContainer}>
        <button>Pan and Zoom</button>
        <button ref={obscureButtonRef}>Obscure</button>
      </div>
    </div>
  );
}

export default ContentEditor;
