import { render } from '@testing-library/react';
import { createRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { IMG_URI, loadImage, obscureOverlay, renderImage, setupOverlayCanvas, selectOverlay, storeOverlay, clearOverlaySelection, getCanvas, initOverlay} from '../../utils/drawing';
import { MouseStateMachine } from '../../utils/mousestatemachine';
import { setCallback } from '../../utils/statemachine';
import styles from './ContentEditor.module.css';

const sm = new MouseStateMachine();

interface ContentEditorProps {}

const ContentEditor = () => {
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [canObscure, setCanObscure] = useState<boolean>(false);
  const [canLink, setCanLink] = useState<boolean>(false);
  const [link, setLink] = useState<string>('');
  const background = useSelector((state: AppReducerState) => state.content.background);
  const overlay = useSelector((state: AppReducerState) => state.content.overlay);
  const apiUrl = useSelector((state: AppReducerState) => state.environment.api);
  const pushTime = useSelector((state: AppReducerState) => state.content.pushTime);

  const obscure = (x1: number, y1: number, x2: number, y2: number) => {
    let overlayStuff = getCanvas(overlayCanvasRef, true);
    if (!overlayStuff) return;
    let { cnvs, ctx } = overlayStuff;

    obscureOverlay.bind(ctx)(x1, y1, x2, y2);
    overlayCanvasRef.current?.toBlob((blob: Blob | null) => {
      if (!blob) {
        // TODO SIGNAL ERROR
        return;
      }
      dispatch({type: 'content/overlay', payload: blob})
    }, 'image/png', 1);
  }

  const keyPress = (key: string) => {
    if (key.toLowerCase() == 'enter') {
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
      dispatch({type: 'content/background', payload: url});
      sm.transition('done');
    } else if (key.toLowerCase() == 'escape') {
      sm.transition('done');
    }
  }

  const selectFile = () => {
    let input = document.createElement('input');
    input.type='file';
    input.multiple = false;
    input.onchange = () => {
      if (!input.files) return sm.transition('done');
      dispatch({type: 'content/background', payload: input.files[0]})
      sm.transition('done');
    }
    input.click();
  }

  useEffect(() => {
    const overlayStuff = getCanvas(overlayCanvasRef, true);
    if (!overlayStuff) return;
    // TODO come back use destructuring assiment... this is lame
    const overlayCnvs = overlayStuff.cnvs;
    const overlayCtx = overlayStuff.ctx;

    setCallback(sm, 'wait', () => {
      sm.resetCoordinates();
      setLink('');
      setShowMenu(false);
      setCanLink(false);
      setCanObscure(false);
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
      obscure(sm.x1(), sm.y1(), sm.x2(), sm.y2());
      sm.transition('wait');
    })
    sm.setMoveCallback(selectOverlay.bind(overlayCtx));
    sm.setStartCallback(storeOverlay.bind(overlayCtx));
    setCallback(sm, 'push', () => dispatch({type: 'content/push'}));

    overlayCnvs.addEventListener('mousedown', (evt: MouseEvent) => {
      sm.transition('down', evt)
    });
    overlayCnvs.addEventListener('mouseup', (evt: MouseEvent) => sm.transition('up', evt));
    overlayCnvs.addEventListener('mousemove', (evt: MouseEvent) => sm.transition('move', evt));
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
    if (!apiUrl || !background) return;
    const content = getCanvas(contentCanvasRef)
    const overlayStuff = getCanvas(overlayCanvasRef, true);
    if (!content || !overlayStuff) return;
    // TODO come back use destructuring assiment... this is lame
    const contentCnvs = content.cnvs;
    const overlayCnvs = overlayStuff.cnvs;
    const contentCtx = content.ctx;
    const overlayCtx = overlayStuff.ctx;  
    let bgImg = `${apiUrl}/${background}`;
    loadImage(bgImg)
      .then(img =>renderImage(img, contentCnvs, contentCtx))
      .then(() => setupOverlayCanvas(contentCnvs, overlayCnvs, overlayCtx))
      .catch(err => {
        // TODO SIGNAL ERROR
        console.log(`Unable to load image: ${JSON.stringify(err)}`);
      });
  }, [apiUrl, background])

  // make sure we end the push state when we get a successful push time update
  useEffect(() => sm.transition('done'), [pushTime])

  // force render of current state as soon as we have an API to talk to
  useEffect(() => {
    if (!apiUrl) return;
    dispatch({type: 'content/pull'}); // TODO why th does this need braces?
  }, [apiUrl]);

  useEffect(() => {
    // if the overlay is a string, then load it. This should only be the case on init
    if (!overlay) return;
    if ((overlay as Blob).type !== undefined) return;
    const overlayStuff = getCanvas(overlayCanvasRef, true);
    if (!overlayStuff) return;
    // TODO come back use destructuring assiment... this is lame
    const overlayCnvs = overlayStuff.cnvs;
    const overlayCtx = overlayStuff.ctx;

    let overlayImg: string = overlay as string;
    loadImage(`${apiUrl}/${overlayImg}?`)
      .then(img => renderImage(img, overlayCnvs, overlayCtx))
      .then(() => initOverlay())
      .catch(err => console.error(err));
  }, [overlay])

  return (
    <div className={styles.ContentEditor}
      data-testid="ContentEditor"
      onFocus={() =>{
        if (sm.current == 'background_upload') {
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
        <button>Pan and Zoom</button>
        <button disabled={!canObscure} onClick={() => {
          sm.transition('obscure')
        }}>Obscure</button>
        <button disabled={!canObscure}>Reveal</button>
        <button onClick={() => sm.transition('push')}>Update</button>
      </div>
    </div>
  );
}

export default ContentEditor;
