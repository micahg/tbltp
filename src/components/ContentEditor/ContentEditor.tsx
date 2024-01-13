import React, {
  RefObject,
  createRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { getRect } from "../../utils/drawing";
import { getWidthAndHeight } from "../../utils/geometry";
import { MouseStateMachine } from "../../utils/mousestatemachine";
import { setCallback } from "../../utils/statemachine";
import styles from "./ContentEditor.module.css";
import {
  RotateRight,
  Opacity,
  ZoomIn,
  ZoomOut,
  LayersClear,
  Sync,
  Map,
  Palette,
  VisibilityOff,
  Visibility,
} from "@mui/icons-material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import {
  Box,
  Menu,
  MenuItem,
  Popover,
  Slider,
  LinearProgress,
} from "@mui/material";
import { setupOffscreenCanvas } from "../../utils/offscreencanvas";
import { DownloadProgress } from "../../utils/contentworker";
import { debounce } from "lodash";

const sm = new MouseStateMachine();

interface ContentEditorProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
  redrawToolbar?: () => void;
  manageScene?: () => void;
}

// hack around rerendering -- keep one object in state and update properties
// so that the object itself remains unchanged.
interface InternalState {
  color: RefObject<HTMLInputElement>;
  obscure: boolean;
  zoom: boolean;
}

const ContentEditor = ({
  populateToolbar,
  redrawToolbar,
  manageScene,
}: ContentEditorProps) => {
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const fullCanvasRef = createRef<HTMLCanvasElement>();
  const colorInputRef = createRef<HTMLInputElement>();

  const [internalState] = useState<InternalState>({
    zoom: false,
    obscure: false,
    color: createRef(),
  });
  const [showBackgroundMenu, setShowBackgroundMenu] = useState<boolean>(false);
  const [showOpacityMenu, setShowOpacityMenu] = useState<boolean>(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState<boolean>(false);
  const [viewportSize, setViewportSize] = useState<number[] | null>(null);
  const [imageSize, setImageSize] = useState<number[] | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [bgRev, setBgRev] = useState<number>(0);
  const [ovRev, setOvRev] = useState<number>(0);
  const [sceneId, setSceneId] = useState<string>(); // used to track flipping between scenes
  const [worker, setWorker] = useState<Worker>();
  const [canvasListening, setCanvasListening] = useState<boolean>(false);
  const [canvassesTransferred, setCanvassesTransferred] =
    useState<boolean>(false); // avoid transfer errors
  const [downloads] = useState<Record<string, number>>({});
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  /**
   * THIS GUY RIGHT HERE IS REALLY IMPORTANT. Because we use a callback to render
   * this components actions to another components toolbar, we will get rerendered
   * more than we want.
   *
   * To avoid rerendering we start with this flag false until we've triggered and
   * ensure any relevant useEffect calls depend on its truth.
   */
  const [toolbarPopulated, setToolbarPopulated] = useState<boolean>(false);

  const auth = useSelector((state: AppReducerState) => state.environment.auth);
  const noauth = useSelector(
    (state: AppReducerState) => state.environment.noauth,
  );
  const scene = useSelector(
    (state: AppReducerState) => state.content.currentScene,
  );
  const apiUrl = useSelector((state: AppReducerState) => state.environment.api);
  const pushTime = useSelector(
    (state: AppReducerState) => state.content.pushTime,
  );

  const updateObscure = useCallback(
    (value: boolean) => {
      if (internalState.obscure !== value && redrawToolbar) {
        internalState.obscure = value;
        redrawToolbar();
      }
    },
    [internalState, redrawToolbar],
  );

  const sceneManager = useCallback(() => {
    if (manageScene) manageScene();
  }, [manageScene]);

  const gmSelectColor = () => {
    if (!internalState.color.current) return;
    const ref = internalState.color.current;
    ref.focus();
    ref.click();
  };

  const gmSelectOpacityMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    sm.transition("opacity");
  };

  /**
   * Handle opacity menu selection.
   * @param option "display" or "render"
   */
  const gmSelectOpacityOption = (option: string) => {
    setShowOpacityMenu(false);
    sm.transition(option);
  };

  const gmSetOpacity = (event: Event, newValue: number | number[]) =>
    sm.transition("change", newValue as number);

  const gmCloseOpacitySlider = () => {
    setShowOpacitySlider(false);
    setAnchorEl(null);
    sm.transition("wait");
  };

  const setOverlayColour = (colour: string) => {
    if (!worker) return;
    const [red, green, blue] = [
      parseInt(colour.slice(1, 3), 16).toString(),
      parseInt(colour.slice(3, 5), 16).toString(),
      parseInt(colour.slice(5, 7), 16).toString(),
    ];
    worker.postMessage({ cmd: "colour", red: red, green: green, blue: blue });
  };

  const handleResizeEvent = debounce(async (e: ResizeObserverEntry[]) => {
    const [w, h] = [e[0].contentRect.width, e[0].contentRect.height];
    if (w === 0 && h === 0) return; // when the component is hidden or destroyed
    if (worker) worker.postMessage({ cmd: "resize", width: w, height: h });
  }, 250);

  const selectOverlay = useCallback(
    (buttons: number, x1: number, y1: number, x2: number, y2: number) => {
      if (!worker) return;
      worker.postMessage({
        cmd: "record",
        buttons: buttons,
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
      });
    },
    [worker],
  );

  /**
   * This method doesn't have access to the updated component state *BECAUSE*
   * its
   */
  const handleWorkerMessage = useCallback(
    (evt: MessageEvent<unknown>) => {
      // bump the overlay version so it gets sent
      if (!evt.data || typeof evt.data !== "object") return;
      if (!("cmd" in evt.data)) return;
      if (evt.data.cmd === "overlay") {
        if ("blob" in evt.data) {
          setOvRev(ovRev + 1);
          dispatch({ type: "content/overlay", payload: evt.data.blob });
        } else console.error("Error: no blob in worker message");
      } else if (evt.data.cmd === "viewport") {
        if ("viewport" in evt.data) {
          const vp = evt.data.viewport;
          dispatch({ type: "content/zoom", payload: { viewport: vp } });
        } else console.error("No viewport in worker message");
      } else if (evt.data.cmd === "initialized") {
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
        setViewportSize([evt.data.width, evt.data.height]);
        setImageSize([evt.data.fullWidth, evt.data.fullHeight]);
      } else if (evt.data.cmd === "pan_complete") {
        // after panning is done, we can go back to waiting state
        sm.transition("wait");
      } else if (evt.data.cmd === "progress") {
        if ("evt" in evt.data) {
          const e = evt.data.evt as DownloadProgress;

          // on complete (progress of 1) remove the download
          if (e.progress === 1) delete downloads[e.img];
          else downloads[e.img] = e.progress;

          // with nothing left we're fully loaded
          const length = Object.keys(downloads).length;
          if (length === 0) return setDownloadProgress(100);

          // otherwise, tally the totals and set the progress
          let value = 0;
          for (const [, v] of Object.entries(downloads)) value += v;
          setDownloadProgress((value * 100) / length);
        }
      }
    },
    [dispatch, downloads, ovRev],
  );

  useEffect(() => {
    if (!internalState || !toolbarPopulated) return;
    internalState.color = colorInputRef;
  }, [internalState, colorInputRef, toolbarPopulated]);

  /**
   * Populate the toolbar with our actions. Empty deps insures this only gets
   * called once on load.
   */
  useEffect(() => {
    if (!populateToolbar) return;

    const actions: GameMasterAction[] = [
      {
        icon: Sync,
        tooltip: "Sync Remote Display",
        hidden: () => false,
        disabled: () => false,
        callback: () => sm.transition("push"),
      },
      {
        icon: Map,
        tooltip: "Scene Backgrounds",
        hidden: () => false,
        disabled: () => false,
        callback: sceneManager,
      },
      {
        icon: Palette,
        tooltip: "Color Palette",
        hidden: () => false,
        disabled: () => false,
        callback: gmSelectColor,
      },
      {
        icon: LayersClear,
        tooltip: "Clear Overlay",
        hidden: () => false,
        disabled: () => internalState.obscure,
        callback: () => sm.transition("clear"),
      },
      {
        icon: VisibilityOff,
        tooltip: "Obscure",
        hidden: () => false,
        disabled: () => !internalState.obscure,
        callback: () => sm.transition("obscure"),
      },
      {
        icon: Visibility,
        tooltip: "Reveal",
        hidden: () => false,
        disabled: () => !internalState.obscure,
        callback: () => sm.transition("reveal"),
      },
      {
        icon: ZoomIn,
        tooltip: "Zoom In",
        hidden: () => internalState.zoom,
        disabled: () => !internalState.obscure,
        callback: () => sm.transition("zoomIn"),
      },
      {
        icon: ZoomOut,
        tooltip: "Zoom Out",
        hidden: () => !internalState.zoom,
        disabled: () => false,
        callback: () => sm.transition("zoomOut"),
      },
      {
        icon: Opacity,
        tooltip: "Opacity",
        hidden: () => false,
        disabled: () => internalState.obscure,
        callback: (evt) => gmSelectOpacityMenu(evt),
      },
      {
        icon: RotateRight,
        tooltip: "Rotate",
        hidden: () => false,
        disabled: () => internalState.obscure,
        callback: () => sm.transition("rotateClock"),
      },
    ];
    populateToolbar(actions);
    setToolbarPopulated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scene || !scene.viewport || !scene.backgroundSize) return;
    // if (!viewport) return;
    if (!viewportSize) return;
    if (!redrawToolbar) return;

    const v = scene.viewport;
    const bg = scene.backgroundSize;
    // need to ignore rotation
    const zoomedOut =
      v.x === bg.x &&
      v.y === bg.y &&
      v.width === bg.width &&
      v.height === bg.height;
    if (zoomedOut !== internalState.zoom) return;
    internalState.zoom = !zoomedOut;
    redrawToolbar();
    sm.transition("wait");
  }, [scene, viewportSize, internalState, redrawToolbar]);

  useEffect(() => {
    /**
     * For now, we do want to run this every render, because we need
     * updated state for some of the callbacks (eg: rotation).
     */
    if (!overlayCanvasRef.current) return;
    if (!viewportSize || !viewportSize.length) return;
    if (!imageSize || !imageSize.length) return;
    if (!scene || !worker) return;

    setCallback(sm, "wait", () => {
      sm.resetCoordinates();
      setShowBackgroundMenu(false);
      setShowOpacityMenu(false);
      updateObscure(false);
    });

    setCallback(sm, "record", () => {
      setShowBackgroundMenu(false);
      setShowOpacityMenu(false);
      updateObscure(true);
      setShowOpacitySlider(false);
    });
    setCallback(sm, "background_select", () => {
      sm.resetCoordinates();
      updateObscure(false);
      setShowBackgroundMenu(true);
    });
    setCallback(sm, "background_link", () => {
      setShowBackgroundMenu(false);
    });
    setCallback(sm, "background_upload", sceneManager);
    setCallback(sm, "obscure", () => {
      worker.postMessage({ cmd: "obscure" });
      sm.transition("wait");
    });
    setCallback(sm, "reveal", () => {
      worker.postMessage({ cmd: "reveal" });
      sm.transition("wait");
    });
    setCallback(sm, "zoomIn", () => {
      if (!worker) return;
      const sel = getRect(sm.x1(), sm.y1(), sm.x2(), sm.y2());
      worker.postMessage({ cmd: "zoom", rect: sel });
    });
    setCallback(sm, "zoomOut", () => {
      const imgRect = getRect(0, 0, imageSize[0], imageSize[1]);
      dispatch({
        type: "content/zoom",
        payload: { backgroundSize: imgRect, viewport: imgRect },
      });
    });
    setCallback(sm, "complete", () => {
      // console.log(`${sm.x1()}, ${sm.x2()}, ${sm.y1()}, ${sm.y2()}`)
      // so if we measure the coordinates to be the same OR the end
      // coordinates, x2 or y2, are less than 0 (no end recorded)
      // just transition back to the start
      if (
        (sm.x1() === sm.x2() && sm.y1() === sm.y2()) ||
        sm.x2() < 0 ||
        sm.y2() < 0
      ) {
        sm.transition("wait");
      }
      worker.postMessage({ cmd: "endrecording" });
    });
    setCallback(sm, "opacity_select", () => {
      sm.resetCoordinates();
      // setCanObscure(false);
      updateObscure(false);
      setShowOpacityMenu(true);
    });
    setCallback(sm, "opacity_display", () => {
      setShowOpacityMenu(false);
      setShowOpacitySlider(true);
    });
    setCallback(sm, "opacity_render", () => {
      setShowOpacityMenu(false);
      setShowOpacitySlider(true);
    });
    setCallback(sm, "update_display_opacity", (args) => {
      if (typeof args[0] !== "number") return;
      const opacity = String(args[0]);
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.style.opacity = opacity;
      }
    });
    setCallback(sm, "update_render_opacity", (args) =>
      worker.postMessage({ cmd: "opacity", opacity: args[0] }),
    );
    sm.setStartCallback(() => worker.postMessage({ cmd: "start_recording" }));
    sm.setMoveCallback(selectOverlay);
    setCallback(sm, "push", () => dispatch({ type: "content/push" }));
    setCallback(sm, "clear", () => {
      worker.postMessage({ cmd: "clear" });
      sm.transition("done");
    });
    setCallback(sm, "rotate_clock", () => {
      const angle = ((scene.angle || 0) + 90) % 360;
      worker.postMessage({ cmd: "rotate", angle: angle });
      dispatch({ type: "content/zoom", payload: { angle: angle } });
      sm.transition("done");
    });
  }, [
    viewportSize,
    dispatch,
    imageSize,
    sceneManager,
    selectOverlay,
    updateObscure,
    scene,
    overlayCanvasRef,
    worker,
  ]);

  useEffect(() => {
    /**
     * We avoid adding listeners or resize observers on every rerender,
     * otherwise, you start stacking up the same event multiple times.
     */
    const canvas = overlayCanvasRef.current;
    if (!worker || !canvas || canvasListening) return;
    // prevent right click context menu on canvas
    canvas.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    canvas.addEventListener("mousedown", (e) => sm.transition("down", e));
    canvas.addEventListener("mouseup", (e) => sm.transition("up", e));
    canvas.addEventListener("mousemove", (e) => sm.transition("move", e));
    canvas.addEventListener("wheel", (e: WheelEvent) => {
      if (e.deltaY > 0) {
        worker.postMessage({ cmd: "zoom_in", x: e.offsetX, y: e.offsetY });
      } else if (e.deltaY < 0) {
        worker.postMessage({ cmd: "zoom_out", x: e.offsetX, y: e.offsetY });
      }
    });

    // watch for canvas size changes and report to worker
    new ResizeObserver((e) => handleResizeEvent(e)).observe(canvas);

    // make sure we don't come back
    setCanvasListening(true);
  }, [canvasListening, handleResizeEvent, overlayCanvasRef, worker]);

  /**
   * This is the main rendering loop. Its a bit odd looking but we're working really hard to avoid repainting
   * when we don't have to. We should only repaint when a scene changes OR an asset version has changed
   */
  useEffect(() => {
    if (
      !apiUrl ||
      !scene ||
      !contentCanvasRef?.current ||
      !overlayCanvasRef?.current ||
      !fullCanvasRef?.current
    )
      return;

    // get the detailed or player content
    const [bRev, bContent] = [
      scene.detailContentRev || scene.playerContentRev || 0,
      scene.detailContent || scene.playerContent,
    ];
    const [oRev, oContent] = [
      scene.overlayContentRev || 0,
      scene.overlayContent,
    ];
    const backgroundCanvas: HTMLCanvasElement = contentCanvasRef.current;
    const overlayCanvas: HTMLCanvasElement = overlayCanvasRef.current;
    const fullCanvas: HTMLCanvasElement = fullCanvasRef.current;

    // update the revisions and trigger rendering if a revision has changed
    let drawBG = bRev > bgRev;
    let drawOV = oRev > ovRev;
    if (drawBG) setBgRev(bRev); // takes effect next render cycle
    if (drawOV) setOvRev(oRev); // takes effect next render cycle

    // this is a scene change, so we can safely assume we must redraw everything that is there.
    // Note that earlier logic (bRev>bgRev or oRev > ovRev) might have prevented us from updating
    // the state because a new scene may have lower version
    if (!sceneId || scene._id !== sceneId) {
      setSceneId(scene._id);
      setBgRev(bRev);
      setOvRev(oRev);
      drawBG = true;
      drawOV = scene.overlayContent !== undefined;
    }

    // if we have nothing new to draw then cheese it
    if (!drawBG && !drawOV) return;

    if (drawBG) {
      const ovUrl = drawOV ? `${apiUrl}/${oContent}` : undefined;
      const bgUrl = drawBG ? `${apiUrl}/${bContent}` : undefined;

      const angle = scene.angle || 0;
      const [scrW, scrH] = getWidthAndHeight();

      // henceforth canvas is transferred -- this doesn't take effect until the next render
      // so the on this pass it is false when passed to setCanvassesTransferred even if set
      setCanvassesTransferred(true);
      const wrkr = setupOffscreenCanvas(
        backgroundCanvas,
        overlayCanvas,
        fullCanvas,
        canvassesTransferred,
        angle,
        scrW,
        scrH,
        bgUrl,
        ovUrl,
      );
      setWorker(wrkr);
      wrkr.onmessage = handleWorkerMessage;
    }
  }, [
    apiUrl,
    bgRev,
    canvassesTransferred,
    contentCanvasRef,
    fullCanvasRef,
    handleWorkerMessage,
    ovRev,
    overlayCanvasRef,
    scene,
    sceneId,
  ]);

  // make sure we end the push state when we get a successful push time update
  useEffect(() => sm.transition("done"), [pushTime]);

  // force render of current state as soon as we have an API to talk to
  // but not before we have loaded the toolbar (otherwise we just get
  // rendered and do it again)
  useEffect(() => {
    // bail if we haven't attempted authorization
    if (auth === undefined) return;
    if (auth === false && noauth === false) return;

    // otherwise wait until we have populated the toolbar before we get our state
    if (!apiUrl || !dispatch || !toolbarPopulated) return;

    // don't pull everything if we already scene data
    if (sceneId) return;

    dispatch({ type: "content/pull" });
  }, [apiUrl, dispatch, toolbarPopulated, auth, noauth, sceneId]);

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* <Box sx={{ margin: "-0.5em", width: `calc(100% + 1em)` }}>
        <LinearProgress />
      </Box> */}
      <canvas className={styles.ContentCanvas} ref={contentCanvasRef}>
        Sorry, your browser does not support canvas.
      </canvas>
      <canvas className={styles.OverlayCanvas} ref={overlayCanvasRef} />
      <canvas hidden ref={fullCanvasRef} />
      <input
        ref={colorInputRef}
        type="color"
        defaultValue="#ff0000"
        onChange={(evt) => setOverlayColour(evt.target.value)}
        hidden
      />
      {showBackgroundMenu && (
        <div className={`${styles.Menu} ${styles.BackgroundMenu}`}>
          <button onClick={() => sm.transition("upload")}>Upload</button>
          <button onClick={() => sm.transition("link")}>Link</button>
        </div>
      )}
      <Menu open={showOpacityMenu} anchorEl={anchorEl}>
        <MenuItem onClick={() => gmSelectOpacityOption("display")}>
          Display Opacity
        </MenuItem>
        <MenuItem onClick={() => gmSelectOpacityOption("render")}>
          Render Opacity
        </MenuItem>
      </Menu>
      <Popover
        anchorEl={anchorEl}
        open={showOpacitySlider}
        onClose={gmCloseOpacitySlider}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Box sx={{ width: "10em", mt: "3em", mb: "1em", mx: "2em" }}>
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
      {downloadProgress > 0 && downloadProgress < 100 && (
        <Box sx={{ margin: "-0.5em", width: `calc(100% + 1em)` }}>
          <LinearProgress variant="determinate" value={downloadProgress} />
        </Box>
      )}
    </Box>
  );
};

export default ContentEditor;
