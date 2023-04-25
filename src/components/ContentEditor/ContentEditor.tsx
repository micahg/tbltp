import { createRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { loadImage, obscureOverlay, renderImage, setupOverlayCanvas, selectOverlay, storeOverlay, clearOverlaySelection, initOverlay, revealOverlay, getRect} from '../../utils/drawing';
import { rotateRect, scaleSelection } from '../../utils/geometry';
import { MouseStateMachine } from '../../utils/mousestatemachine';
import { setCallback } from '../../utils/statemachine';
import styles from './ContentEditor.module.css';

const sm = new MouseStateMachine();

const ContentEditor = () => {
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  
  const [contentCtx, setContentCtx] = useState<CanvasRenderingContext2D|null>(null);
  const [overlayCtx, setOverlayCtx] = useState<CanvasRenderingContext2D|null>(null);
  const [backgroundLoaded, setBackgroundLoaded] = useState<boolean>(false);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [canObscure, setCanObscure] = useState<boolean>(false);
  const [canLink, setCanLink] = useState<boolean>(false);
  const [link, setLink] = useState<string>('');
  const [backgroundSize, setBackgroundSize] = useState<number[]|null>(null);
  const [zoomedIn, setZoomedIn] = useState<boolean>(false);
  const background = useSelector((state: AppReducerState) => state.content.background);
  const overlay = useSelector((state: AppReducerState) => state.content.overlay);
  const apiUrl = useSelector((state: AppReducerState) => state.environment.api);
  const pushTime = useSelector((state: AppReducerState) => state.content.pushTime);
  const viewport = useSelector((state: AppReducerState) => state.content.viewport);

  const updateBackground = (data: URL | File) => {
      // send without payload to wipe overlay
      dispatch({type: 'content/overlay'});

      // update our internal state to indicate we have no background... yet
      setBackgroundLoaded(false);

      // send the new background
      dispatch({type: 'content/background', payload: data});
  }

  const obscure = (x1: number, y1: number, x2: number, y2: number) => {
    if (!overlayCtx) return;
    obscureOverlay.bind(overlayCtx)(x1, y1, x2, y2);
    overlayCanvasRef.current?.toBlob((blob: Blob | null) => {
      if (!blob) {
        // TODO SIGNAL ERROR
        return;
      }
      dispatch({type: 'content/overlay', payload: blob})
    }, 'image/png', 1);
  }

  const reveal = (x1: number, y1: number, x2: number, y2: number) => {
    if (!overlayCtx) return;
    revealOverlay.bind(overlayCtx)(x1, y1, x2, y2);
    overlayCanvasRef.current?.toBlob((blob: Blob | null) => {
      if (!blob) {
        // TODO SIGNAL ERROR
        return;
      }
      dispatch({type: 'content/overlay', payload: blob})
    }, 'image/png', 1);
  }

  const keyPress = (key: string) => {
    if (key.toLowerCase() === 'enter') {
      let url: URL | null= null;
      try {
        url = new URL(link);
      } catch (err) {
        // TODO MATERIAL use snackbar
        alert('Invalid URL!')
        return;
      }

      if (!url) {
        alert('Something went wrong!');
        return;
      }
      updateBackground(url);
      sm.transition('done');
    } else if (key.toLowerCase() === 'escape') {
      sm.transition('done');
    }
  }

  const selectFile = () => {
    let input = document.createElement('input');
    input.type='file';
    input.multiple = false;
    input.onchange = () => {
      if (!input.files) return sm.transition('done');
      updateBackground(input.files[0]);
      sm.transition('done');
    }
    input.click();
  }

  const zoomIn = (x1: number, y1: number, x2: number, y2: number) => {
    if (!backgroundSize) return;
    if (!overlayCtx) return;
    if (!overlayCtx.canvas) return;
    let sel = getRect(x1, y1, x2, y2);
    // the viewport (vp) in this case is not relative to the background image
    // size, but the size of the canvas upon which it is painted
    let vp = getRect(0,0, overlayCtx.canvas.width, overlayCtx.canvas.height);
    let [w, h] = backgroundSize;

    // rotate the selection
    // TODO this doesn't need rotation in portrait
    if (w < h) {
      sel = rotateRect(-90, sel, vp.width, vp.height);
      vp = getRect(0,0, overlayCtx.canvas.height, overlayCtx.canvas.width);
    }
    let payload = scaleSelection(sel, vp, w, h);
    dispatch({type: 'content/zoom', payload: payload});
    sm.transition('wait');
  }

  const zoomOut = () => {
    if (!backgroundSize) return;
    dispatch({type: 'content/zoom', payload: getRect(0, 0, backgroundSize[0], backgroundSize[1])});
  }

  // if we don't have a canvas OR have already set context, then bail
  useEffect(() => {
    if (!contentCanvasRef.current || contentCtx != null) return;
    setContentCtx(contentCanvasRef.current.getContext('2d', { alpha: false }));
  }, [contentCanvasRef, contentCtx]);

  useEffect(() => {
    if (!overlayCanvasRef.current || overlayCtx != null) return;
    setOverlayCtx(overlayCanvasRef.current.getContext('2d', { alpha: true }));
  }, [overlayCanvasRef, overlayCtx]);

  useEffect(() => {
    if (!viewport) return;
    if (!backgroundSize) return;
    let v = viewport;
    let [w, h] = backgroundSize;
    let zoomedOut: boolean = (v.x === 0 && v.y === 0 && w === v.width && h === v.height);
    // if zoomed out and in then state changed.... think about it man...
    if (zoomedOut !== zoomedIn) return;
    setZoomedIn(!zoomedOut);
    sm.transition('wait');
  }, [viewport, backgroundSize, zoomedIn]);


  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    if (!overlayCtx) return;

    setCallback(sm, 'wait', () => {
      sm.resetCoordinates();
      setLink('');
      setShowMenu(false);
      setCanLink(false);
      setCanObscure(false);
      clearOverlaySelection.bind(overlayCtx)();
    });
    
    setCallback(sm, 'record', () => {
      setShowMenu(false)
      setCanObscure(true);
    });
    setCallback(sm, 'background_select', () => {
      clearOverlaySelection.bind(overlayCtx)();
      sm.resetCoordinates();
      setCanObscure(false);
      setShowMenu(true);
    });
    setCallback(sm, 'background_link', () => {
      setCanLink(true);
      setShowMenu(false);
    });
    setCallback(sm, 'background_upload', selectFile);
    setCallback(sm, 'obscure', () => {
      // console.log(`Obscuring ${sm.x1()}, ${sm.y1()}, ${sm.x2()}, ${sm.y2()}`);
      obscure(sm.x1(), sm.y1(), sm.x2(), sm.y2());
      sm.transition('wait');
    });
    setCallback(sm, 'reveal', () => {
      reveal(sm.x1(), sm.y1(), sm.x2(), sm.y2());
      sm.transition('wait');
    });
    setCallback(sm, 'zoomIn', () => {
      // console.log(`Zooming ${sm.x1()}, ${sm.y1()}, ${sm.x2()}, ${sm.y2()}`);
      zoomIn(sm.x1(), sm.y1(), sm.x2(), sm.y2())
    });
    setCallback(sm, 'zoomOut', () => zoomOut());
    setCallback(sm, 'complete', () => {
      // console.log(`${sm.x1()}, ${sm.x2()}, ${sm.y1()}, ${sm.y2()}`)
      // so if we measure the coordinates to be the same OR the end
      // coordinates, x2 or y2, are less than 0 (no end recorded)
      // just transition back to the start
      if ((sm.x1() === sm.x2() && sm.y1() === sm.y2()) || sm.x2() < 0 || sm.y2() < 0) {
        sm.transition('wait');
      }
    });
    sm.setMoveCallback(selectOverlay.bind(overlayCtx));
    sm.setStartCallback(storeOverlay.bind(overlayCtx));
    setCallback(sm, 'push', () => dispatch({type: 'content/push'}));

    overlayCanvasRef.current.addEventListener('mousedown', (evt: MouseEvent) => {
      sm.transition('down', evt)
    });
    overlayCanvasRef.current.addEventListener('mouseup', (evt: MouseEvent) => sm.transition('up', evt));
    overlayCanvasRef.current.addEventListener('mousemove', (evt: MouseEvent) => sm.transition('move', evt));
  });

  /**
   * Little context here... this component wont render the background directly!
   * It will send to the server and wait for the result to update it.  So, we
   * dont actually need the apiUrl but whatever, it just ensures we're in a good
   * state.
   * 
   * There is a bit of a situation here though because we might also get the overlay
   * before we get the background and we can't really sequence these events.
   */
  useEffect(() => {
    if (!apiUrl || !background || !contentCtx || !overlayCtx) return;
    let bgImg = `${apiUrl}/${background}`;
    loadImage(bgImg)
      .then(img => {
        setBackgroundSize([img.width, img.height]);
        dispatch({type: 'content/zoom', payload: getRect(0, 0, img.width, img.height)})
        return img;
      })
      .then(img => renderImage(img, contentCtx, true))
      .then(bounds => {
        setBackgroundLoaded(true);
        setupOverlayCanvas(bounds, overlayCtx);
      })
      .catch(err => {
        // TODO SIGNAL ERROR
        console.log(`Unable to load image: ${JSON.stringify(err)}`);
      });
  }, [apiUrl, background, contentCtx, overlayCtx, dispatch])

  // make sure we end the push state when we get a successful push time update
  useEffect(() => sm.transition('done'), [pushTime])

  // force render of current state as soon as we have an API to talk to
  useEffect(() => {
    if (!apiUrl || !dispatch) return;
    dispatch({type: 'content/pull'}); // TODO why th does this need braces?
  }, [apiUrl, dispatch]);

  useEffect(() => {
    // if the background isn't loaded yet, no point rendering the overlay
    if (!backgroundLoaded) return;
    // if the overlay is a string, then load it. This should only be the case on init
    if (!overlay) return;
    if ((overlay as Blob).type !== undefined) return;
    if (!overlayCtx) return;

    let overlayImg: string = overlay as string;
    loadImage(`${apiUrl}/${overlayImg}?`)
      .then(img => renderImage(img, overlayCtx))
      .then(() => initOverlay())
      .catch(err => console.error(err));
  }, [apiUrl, overlay, backgroundLoaded, overlayCtx])

  return (
    <div className={styles.ContentEditor}
      data-testid="ContentEditor"
      onFocus={() =>{
        if (sm.current === 'background_upload') {
          sm.transition('done')
        }
      }}
    >
      <div className={styles.ContentContainer} data-testid="RemoteDisplayComponent">
        <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>Sorry, your browser does not support canvas.</canvas>
        <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef}/>
      </div>
      {showMenu && <div className={styles.BackgroundMenu}>
        <button onClick={() => sm.transition('upload')}>Upload</button>
        <button onClick={() => sm.transition('link')}>Link</button>
      </div>}
      <div className={styles.ControlsContainer}>
        <input
          value={link}
          disabled={!canLink}
          onChange={(e) => setLink(e.target.value)}
          onKeyUp={(e) => keyPress(e.key)}>
        </input>
        <button onClick={() => sm.transition('background')}>Background</button>
        <button hidden={zoomedIn} disabled={!canObscure} onClick={() => sm.transition('zoomIn')}>Zoom In</button>
        <button hidden={!zoomedIn} onClick={() => sm.transition('zoomOut')}>Zoom Out</button>
        <button disabled={!canObscure} onClick={() => sm.transition('obscure')}>Obscure</button>
        <button disabled={!canObscure} onClick={() => sm.transition('reveal')}>Reveal</button>
        <button onClick={() => sm.transition('push')}>Update</button>
      </div>
    </div>
  );
}

export default ContentEditor;
