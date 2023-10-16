import React, { RefObject, createRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { loadImage, obscureOverlay, setupOverlayCanvas,
         selectOverlay, storeOverlay, clearOverlaySelection, revealOverlay,
         getRect, clearOverlay, setOverlayOpacity,
         setOverlayColour, 
         renderImageInContainer,
         setOverlayAsBaseData} from '../../utils/drawing';
import { rotateRect, scaleSelection } from '../../utils/geometry';
import { MouseStateMachine } from '../../utils/mousestatemachine';
import { setCallback } from '../../utils/statemachine';
import styles from './ContentEditor.module.css';
import { Opacity, ZoomIn, ZoomOut, LayersClear, Sync, FileUpload, Palette, VisibilityOff, Visibility } from '@mui/icons-material';
import { GameMasterAction } from '../GameMasterActionComponent/GameMasterActionComponent';
import { Box, Menu, MenuItem, Popover, Slider } from '@mui/material';

const sm = new MouseStateMachine();

interface ContentEditorProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
  redrawToolbar?: () => void;
}

// hack around rerendering -- keep one object in state and update properties
// so that the object itself remains unchanged.
interface InternalState {
  color: RefObject<HTMLInputElement>;
  obscure: boolean;
  zoom: boolean;
}

const ContentEditor = ({populateToolbar, redrawToolbar}: ContentEditorProps) => {
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const colorInputRef = createRef<HTMLInputElement>();
  
  const [internalState, ] = useState<InternalState>({zoom: false, obscure: false, color: createRef()});
  const [contentCtx, setContentCtx] = useState<CanvasRenderingContext2D|null>(null);
  const [overlayCtx, setOverlayCtx] = useState<CanvasRenderingContext2D|null>(null);
  const [backgroundLoaded, setBackgroundLoaded] = useState<boolean>(false);
  const [showBackgroundMenu, setShowBackgroundMenu] = useState<boolean>(false);
  const [showOpacityMenu, setShowOpacityMenu] = useState<boolean>(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState<boolean>(false);
  const [backgroundSize, setBackgroundSize] = useState<number[]|null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  /**
   * THIS GUY RIGHT HERE IS REALLY IMPORTANT. Because we use a callback to render
   * this components actions to another components toolbar, we will get rerendered
   * more thatn we want.
   *
   * To avoid rerendering we start with this flag false until we've triggered and
   * ensure any relevant useEffect calls depend on its truth.
   */
  const [toolbarPopulated, setToolbarPopulated] = useState<boolean>(false);

  const auth = useSelector((state: AppReducerState) => state.environment.auth);
  const noauth = useSelector((state: AppReducerState) => state.environment.noauth);
  const background = useSelector((state: AppReducerState) => state.content.currentScene?.tableContent);
  const overlay = useSelector((state: AppReducerState) => state.content.currentScene?.overlayContent);
  const apiUrl = useSelector((state: AppReducerState) => state.environment.api);
  const pushTime = useSelector((state: AppReducerState) => state.content.pushTime);
  const viewport = useSelector((state: AppReducerState) => state.content.currentScene?.viewport);

  const updateBackground = (data: URL | File) => {
    // send without payload to wipe overlay
    dispatch({type: 'content/overlay'});

    // update our internal state to indicate we have no background... yet
    setBackgroundLoaded(false);

    // send the new background
    dispatch({type: 'content/background', payload: data});
  }

  const updateOverlay = () => {
    overlayCanvasRef.current?.toBlob((blob: Blob | null) => {
      if (!blob) {
        // TODO SIGNAL ERROR
        return;
      }
      dispatch({type: 'content/overlay', payload: blob})
    }, 'image/png', 1);
  }

  const updateObscure = (value: boolean) => {
    if (internalState.obscure !== value && redrawToolbar) {
      internalState.obscure = value;
      redrawToolbar();
    }
  }
  const obscure = (x1: number, y1: number, x2: number, y2: number) => {
    if (!overlayCtx) return;
    obscureOverlay.bind(overlayCtx)(x1, y1, x2, y2);
    updateOverlay();
  }

  const reveal = (x1: number, y1: number, x2: number, y2: number) => {
    if (!overlayCtx) return;
    revealOverlay.bind(overlayCtx)(x1, y1, x2, y2);
    updateOverlay();
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
    let selection = scaleSelection(sel, vp, w, h);
        dispatch({type: 'content/zoom', payload: {'viewport': selection}});
    sm.transition('wait');
  }

  const zoomOut = () => {
    if (!backgroundSize) return;
    let imgRect = getRect(0, 0, backgroundSize[0], backgroundSize[1]);
    dispatch({type: 'content/zoom', payload: {'backgroundSize': imgRect, 'viewport': imgRect}});
  }

  const gmSelectColor = () => {
    if (!internalState.color.current) return;
    const ref = internalState.color.current;
    ref.focus();
    ref.click();
  }

  const gmSelectOpacityMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    sm.transition('opacity')
  }

  /**
   * Handle opacity menu selection.
   * @param option "display" or "render"
   */
  const gmSelectOpacityOption = (option: string) => {
    setShowOpacityMenu(false);
    sm.transition(option);
  }

  const gmSetOpacity = (event: Event, newValue: number | number[]) => sm.transition('change', newValue as number);

  const gmCloseOpacitySlider = () => {
    setShowOpacitySlider(false);
    setAnchorEl(null);
    sm.transition('wait');
  }

  useEffect(() => {
    if (!internalState || !toolbarPopulated) return;
    internalState.color = colorInputRef
  }, [internalState, colorInputRef, toolbarPopulated]);

  /**
   * Populate the toolbar with our actions. Empty deps insures this only gets
   * called once on load.
   */
  useEffect(() => {
    if (!populateToolbar) return;

    const actions: GameMasterAction[] = [
      { icon: Sync,          tooltip: "Sync Remote Display",       hidden: () => false,               disabled: () => false,                  callback: () => sm.transition('push') },
      { icon: FileUpload,    tooltip: "Upload or Link Background", hidden: () => false,               disabled: () => false,                  callback: selectFile },
      { icon: Palette,       tooltip: "Color Palette",             hidden: () => false,               disabled: () => false,                  callback: gmSelectColor },
      { icon: LayersClear,   tooltip: "Clear Overlay",             hidden: () => false,               disabled: () => internalState.obscure,  callback: () => sm.transition('clear')},
      { icon: VisibilityOff, tooltip: "Obscure",                   hidden: () => false,               disabled: () => !internalState.obscure, callback: () => sm.transition('obscure')},
      { icon: Visibility,    tooltip: "Reveal",                    hidden: () => false,               disabled: () => !internalState.obscure, callback: () => sm.transition('reveal')},
      { icon: ZoomIn,        tooltip: "Zoom In",                   hidden: () => internalState.zoom,  disabled: () => !internalState.obscure, callback: () => sm.transition('zoomIn')},
      { icon: ZoomOut,       tooltip: "Zoom Out",                  hidden: () => !internalState.zoom, disabled: () => false,                  callback: () => sm.transition('zoomOut')},
      { icon: Opacity,       tooltip: "Opacity",                   hidden: () => false,               disabled: () => internalState.obscure,  callback: (evt) => gmSelectOpacityMenu(evt)}
    ];
    populateToolbar(actions);
    setToolbarPopulated(true);
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

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
    if (!redrawToolbar) return;
    let v = viewport;
        let [w, h] = backgroundSize;
    let zoomedOut: boolean = (v.x === 0 && v.y === 0 && w === v.width && h === v.height);
    // if zoomed out and in then state changed.... think about it man...
    // if (zoomedOut !== zoomedIn) return;
    // setZoomedIn(!zoomedOut);
    if (zoomedOut !== internalState.zoom) return;
    internalState.zoom = !zoomedOut;
    redrawToolbar();

    sm.transition('wait');
  }, [viewport, backgroundSize, internalState, redrawToolbar]);


  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    if (!overlayCtx) return;

    setCallback(sm, 'wait', () => {
      sm.resetCoordinates();
      setShowBackgroundMenu(false);
      setShowOpacityMenu(false);
      updateObscure(false);
      clearOverlaySelection.bind(overlayCtx)();
    });

    setCallback(sm, 'record', () => {
      setShowBackgroundMenu(false)
      setShowOpacityMenu(false);
      updateObscure(true);
      setShowOpacitySlider(false);
    });
    setCallback(sm, 'background_select', () => {
      clearOverlaySelection.bind(overlayCtx)();
      sm.resetCoordinates();
      updateObscure(false);
      setShowBackgroundMenu(true);
    });
    setCallback(sm, 'background_link', () => {
      setShowBackgroundMenu(false);
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
    setCallback(sm, 'opacity_select', () => {
      clearOverlaySelection.bind(overlayCtx)();
      sm.resetCoordinates();
      // setCanObscure(false);
      updateObscure(false);
      setShowOpacityMenu(true);
    });
    setCallback(sm, 'opacity_display', () => {
      setShowOpacityMenu(false);
      setShowOpacitySlider(true);
    });
    setCallback(sm, 'opacity_render', () => {
      setShowOpacityMenu(false);
      setShowOpacitySlider(true);
    });
    setCallback(sm, 'update_display_opacity', (args) => {
      const opacity: string = args[0];
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.style.opacity=opacity;
      }
    });
    setCallback(sm, 'update_render_opacity', (args) => setOverlayOpacity(args[0]));

    sm.setMoveCallback(selectOverlay.bind(overlayCtx));
    sm.setStartCallback(storeOverlay.bind(overlayCtx));
    setCallback(sm, 'push', () => dispatch({type: 'content/push'}));
    setCallback(sm, 'clear', () => {
      clearOverlay(overlayCtx);
      updateOverlay();
      sm.transition('done');
    });

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
        let imgRect = getRect(0, 0, img.width, img.height);
        dispatch({type: 'content/zoom', payload: {'backgroundSize': imgRect, 'viewport': imgRect}});    
        return img;
      })
      // MICAH fix render image to use the container height and width
      .then(img => renderImageInContainer(img, contentCtx, true))
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
  // but not before we have loaded the toolbar (otherwise we just get
  // rendered and do it again)
  useEffect(() => {
    // bail if we haven't attempted authorization
    if (auth === undefined) return;
    if (auth === false && noauth === false) return;

    // otherwise wait until we have populated the toolbar before we get our state
    if (!apiUrl || !dispatch || !toolbarPopulated) return;
    dispatch({type: 'content/pull'});
  }, [apiUrl, dispatch, toolbarPopulated, auth, noauth]);

  useEffect(() => {
    // if the background isn't loaded yet, no point rendering the overlay
    if (!backgroundLoaded) return;
    // if the overlay is a string, then load it. This should only be the case on init
    if (!overlay) return;
    if (((overlay as unknown) as Blob).type !== undefined) return;
    if (!overlayCtx) return;

    let overlayImg: string = overlay as string;
    loadImage(`${apiUrl}/${overlayImg}?`)
      .then(img => renderImageInContainer(img, overlayCtx))
      .then(() => setOverlayAsBaseData(overlayCtx))
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
      <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>Sorry, your browser does not support canvas.</canvas>
      <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef}/>
      <input ref={colorInputRef} type='color' defaultValue='#ff0000' onChange={(evt) => setOverlayColour(evt.target.value)}/>
      {showBackgroundMenu && <div className={`${styles.Menu} ${styles.BackgroundMenu}`}>
        <button onClick={() => sm.transition('upload')}>Upload</button>
        <button onClick={() => sm.transition('link')}>Link</button>
      </div>}
      <Menu open={showOpacityMenu} anchorEl={anchorEl}>
        <MenuItem onClick={() => gmSelectOpacityOption('display')}>Display Opacity</MenuItem>
        <MenuItem onClick={() => gmSelectOpacityOption('render')}>Render Opacity</MenuItem>
      </Menu>
      <Popover
        anchorEl={anchorEl}
        open={showOpacitySlider}
        onClose={gmCloseOpacitySlider}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Box sx={{width: "10em", mt: "3em", mb: "1em", mx: "2em"}}>
          <Slider
            min={0}
            max={1}
            step={0.01}
            defaultValue={1}
            aria-label="Default"
            valueLabelDisplay="auto"
            onChange={gmSetOpacity}
          />
        </Box>
      </Popover>
    </div>
  );
}

export default ContentEditor;
