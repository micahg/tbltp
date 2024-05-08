// trigger rebuild.
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
import { Rect, getWidthAndHeight } from "../../utils/geometry";
import { MouseStateMachine } from "../../utils/mousestatemachine";
import { setCallback } from "../../utils/statemachine";
import styles from "./ContentEditor.module.css";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Rectangle,
  RotateRight,
  Opacity,
  ZoomIn,
  ZoomOut,
  LayersClear,
  Brush,
  Sync,
  Map,
  Palette,
  VisibilityOff,
  Visibility,
  EditOff,
} from "@mui/icons-material";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import {
  Box,
  Menu,
  MenuItem,
  Popover,
  Slider,
  LinearProgress,
  Paper,
  Typography,
  Alert,
  IconButton,
} from "@mui/material";
import { setupOffscreenCanvas } from "../../utils/offscreencanvas";
import { debounce } from "lodash";
import { LoadProgress } from "../../utils/content";

const sm = new MouseStateMachine();

interface ContentEditorProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
  redrawToolbar?: () => void;
  manageScene?: () => void;
}

// enum RecordingAction {
//   None,
//   Select,
//   Paint,
//   Erase,
// }

type RecordingAction = "none" | "select" | "paint" | "erase";

// hack around rerendering -- keep one object in state and update properties
// so that the object itself remains unchanged.
interface InternalState {
  color: RefObject<HTMLInputElement>;
  selecting: boolean;
  selected: boolean;
  zoom: boolean;
  painting: boolean;
  recording: RecordingAction;
  isRecording: boolean;
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
    selecting: false,
    selected: false,
    color: createRef(),
    painting: false,
    recording: "none",
    isRecording: false,
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
  const [selection, setSelection] = useState<Rect | null>(null);

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
  const authErr = useSelector(
    (state: AppReducerState) => state.environment.authErr,
  );
  const noauth = useSelector(
    (state: AppReducerState) => state.environment.noauth,
  );
  const scene = useSelector(
    (state: AppReducerState) => state.content.currentScene,
  );
  const apiUrl = useSelector((state: AppReducerState) => state.environment.api);
  const bearer = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );
  const pushTime = useSelector(
    (state: AppReducerState) => state.content.pushTime,
  );

  const updateSelecting = useCallback(
    (value: boolean) => {
      if (internalState.selecting !== value && redrawToolbar) {
        internalState.selecting = value;
        redrawToolbar();
      }
    },
    [internalState, redrawToolbar],
  );
  const updateSelected = useCallback(
    (value: boolean) => {
      if (internalState.selected !== value && redrawToolbar) {
        internalState.selected = value;
        redrawToolbar();
      }
    },
    [internalState, redrawToolbar],
  );

  const updatePainting = useCallback(
    (value: boolean) => {
      if (internalState.painting !== value && redrawToolbar) {
        internalState.painting = value;
        redrawToolbar();
      }
    },
    [internalState, redrawToolbar],
  );

  const updateRecording = useCallback(
    (value: boolean) => {
      if (internalState.isRecording !== value && redrawToolbar) {
        internalState.isRecording = value;
        if (!value) {
          internalState.recording = "none";
        }
        redrawToolbar();
      }
    },
    [internalState, redrawToolbar],
  );

  const prepareRecording = useCallback(
    (action: RecordingAction) => {
      internalState.isRecording = false;
      internalState.recording = action;
      if (action === "erase") {
        // TODO MICAH THIS SHOULD BECOME "record"
        sm.transition("paint");
      }
    },
    [internalState],
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

  const handleMouseMove = useCallback(
    (buttons: number, x: number, y: number) => {
      if (!worker) return;
      let cmd;
      if (internalState.painting) cmd = "paint";
      else if (internalState.selecting) cmd = "record";
      else if (internalState.isRecording) {
        cmd = internalState.recording;
      } else cmd = "move";
      worker.postMessage({
        cmd: cmd,
        buttons: buttons,
        x: x,
        y: y,
      });
    },
    [
      worker,
      internalState.painting,
      internalState.selecting,
      internalState.isRecording,
      internalState.recording,
    ],
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
        disabled: () => internalState.painting || internalState.selecting,
        callback: () => sm.transition("push"),
      },
      {
        icon: Map,
        tooltip: "Scene Backgrounds",
        hidden: () => false,
        disabled: () => internalState.painting || internalState.selecting,
        callback: sceneManager,
      },
      {
        icon: Palette,
        tooltip: "Color Palette",
        hidden: () => false,
        disabled: () => internalState.painting || internalState.selecting,
        callback: gmSelectColor,
      },
      {
        icon: LayersClear,
        tooltip: "Clear Overlay",
        hidden: () => false,
        disabled: () => internalState.selecting || internalState.painting,
        callback: () => sm.transition("clear"),
      },
      {
        icon: VisibilityOff,
        tooltip: "Obscure",
        hidden: () => false,
        disabled: () => !internalState.selected,
        callback: () => sm.transition("obscure"),
      },
      {
        icon: Visibility,
        tooltip: "Reveal",
        hidden: () => false,
        disabled: () => !internalState.selected,
        callback: () => sm.transition("reveal"),
      },
      {
        icon: ZoomIn,
        tooltip: "Zoom In",
        hidden: () => internalState.zoom,
        disabled: () => !internalState.selected,
        callback: () => sm.transition("remoteZoomIn"),
      },
      {
        icon: ZoomOut,
        tooltip: "Zoom Out",
        hidden: () => !internalState.zoom,
        disabled: () => false,
        callback: () => sm.transition("remoteZoomOut"),
      },
      {
        icon: Opacity,
        tooltip: "Opacity",
        hidden: () => false,
        disabled: () => internalState.selecting || internalState.painting,
        callback: (evt) => gmSelectOpacityMenu(evt),
      },
      {
        icon: RotateRight,
        tooltip: "Rotate",
        hidden: () => false,
        disabled: () => internalState.selecting || internalState.painting,
        callback: () => sm.transition("rotateClock"),
      },
      {
        icon: EditOff,
        tooltip: "Erase",
        hidden: () => internalState.isRecording,
        disabled: () =>
          internalState.painting ||
          (internalState.isRecording && internalState.recording !== "erase"),
        callback: () => prepareRecording("erase"),
      },
      {
        icon: EditOff,
        tooltip: "Finish Erase",
        emphasis: true,
        hidden: () => !internalState.isRecording,
        disabled: () => false,
        callback: () => sm.transition("wait"),
      },
      {
        icon: Brush,
        tooltip: "Paint",
        hidden: () => internalState.painting,
        disabled: () => internalState.selecting,
        callback: () => sm.transition("paint"),
      },
      {
        icon: Brush,
        tooltip: "Finish Paint",
        emphasis: true,
        hidden: () => !internalState.painting,
        disabled: () => false,
        callback: () => sm.transition("wait"),
      },
      {
        icon: Rectangle,
        tooltip: "Select",
        hidden: () => internalState.selecting,
        disabled: () => internalState.painting,
        callback: () => sm.transition("select"),
      },
      {
        icon: Rectangle,
        tooltip: "Finish Select",
        emphasis: true,
        hidden: () => !internalState.selecting,
        disabled: () => false,
        callback: () => sm.transition("wait"),
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
      // if we're on wait we are brand new OR we've come from complete (eg: select or paint)
      // either way, we need to basically disable most actions and make sure the worker is
      // chilled out
      sm.resetCoordinates();
      setShowBackgroundMenu(false);
      setShowOpacityMenu(false);
      // these ones update internal state - can't wait to fix that - doesn't feel right
      updateSelecting(false);
      updateRecording(false);
      // state machine for paint loops from complete back to paint to prevent having to click
      // the paint button every time. So, now we know we're *really* done, make sure the worker
      // knows too and stops recording mouse events
      worker.postMessage({ cmd: "wait" });
      updatePainting(false);
      updateSelected(false);
    });

    setCallback(sm, "record", () => {
      setShowBackgroundMenu(false);
      setShowOpacityMenu(false);
      setShowOpacitySlider(false);
      updateSelected(false);
    });
    setCallback(sm, "background_select", () => {
      sm.resetCoordinates();
      updateSelecting(false);
      updateSelected(false);
      setShowBackgroundMenu(true);
    });
    setCallback(sm, "background_link", () => {
      setShowBackgroundMenu(false);
    });
    setCallback(sm, "background_upload", sceneManager);
    setCallback(sm, "obscure", () => {
      worker.postMessage({ cmd: "obscure", rect: selection });
      sm.transition("select");
    });
    setCallback(sm, "reveal", () => {
      worker.postMessage({ cmd: "reveal", rect: selection });
      sm.transition("select");
    });
    setCallback(sm, "remoteZoomIn", () => {
      if (!worker) return;
      sm.transition("select");
      worker.postMessage({ cmd: "zoom", rect: selection });
    });
    setCallback(sm, "remoteZoomOut", () => {
      const imgRect = getRect(0, 0, imageSize[0], imageSize[1]);
      dispatch({
        type: "content/zoom",
        payload: { backgroundSize: imgRect, viewport: imgRect },
      });
    });
    setCallback(sm, "complete", () => {
      if (internalState.selecting) {
        worker.postMessage({ cmd: "end_selecting" });
        updateSelected(true);
      } else if (internalState.painting) {
        worker.postMessage({ cmd: "end_painting" });
        sm.transition("paint");
      } else if (internalState.isRecording) {
        worker.postMessage({ cmd: `end_${internalState.recording}` });
        // TODO MICAH MAKE THIS RECORDING
        sm.transition("paint");
      } else {
        worker.postMessage({ cmd: "end_panning" });
        sm.transition("wait");
      }
    });
    setCallback(sm, "opacity_select", () => {
      sm.resetCoordinates();
      updateSelecting(false);
      updateSelected(false);
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
    sm.setMoveCallback(handleMouseMove);
    setCallback(sm, "push", () => dispatch({ type: "content/push" }));
    setCallback(sm, "clear", () => {
      worker.postMessage({ cmd: "clear" });
      sm.transition("done");
    });
    setCallback(sm, "select", () => {
      updateSelecting(true);
      updateSelected(false);
      updatePainting(false);
    });
    // TODO MICAH THIS SHOULD BE RECORD
    setCallback(sm, "paint", () => {
      updateSelecting(false);
      updateSelected(false);
      if (internalState.recording === "erase") {
        updateRecording(true);
      } else updatePainting(true);
    });
    setCallback(sm, "painting", () => {
      console.log("NOW PAINTING");
    });
    setCallback(sm, "zoom", (args) => {
      sm.transition("wait");
      const e: WheelEvent = args[0] as WheelEvent;
      if (e.deltaY > 0) {
        worker.postMessage({ cmd: "zoom_in", x: e.offsetX, y: e.offsetY });
      } else if (e.deltaY < 0) {
        worker.postMessage({ cmd: "zoom_out", x: e.offsetX, y: e.offsetY });
      }
    });
    setCallback(sm, "record_mouse_wheel", (args) => {
      if (internalState.painting) {
        sm.transition("done");
        const e: WheelEvent = args[0] as WheelEvent;
        if (e.deltaY > 0) {
          worker.postMessage({ cmd: "brush_inc", x: e.offsetX, y: e.offsetY });
        } else if (e.deltaY < 0) {
          worker.postMessage({ cmd: "brush_dec", x: e.offsetX, y: e.offsetY });
        }
      }
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
    handleMouseMove,
    updateSelecting,
    updatePainting,
    updateSelected,
    scene,
    overlayCanvasRef,
    worker,
    internalState,
    selection,
    updateRecording,
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
    canvas.addEventListener("wheel", (e) => sm.transition("wheel", e));

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
      !bearer ||
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
        bearer,
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
    bearer,
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
      {showBackgroundMenu && (
        <div className={`${styles.Menu} ${styles.BackgroundMenu}`}>
          <button onClick={() => sm.transition("upload")}>Upload</button>
          <button onClick={() => sm.transition("link")}>Link</button>
        </div>
      )}
      {authErr !== undefined && (
        <Box sx={{ pt: "1em", pr: "1em", pl: "1em" }}>
          <Alert
            severity="error"
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
              ></IconButton>
            }
          >
            {authErr.error}: {authErr.reason}
          </Alert>
        </Box>
      )}
      {!scene?.playerContent && (
        <Box sx={{ padding: "1em" }}>
          <Paper sx={{ padding: "1em", margin: "1em 0" }} elevation={6}>
            <Typography variant="h5" gutterBottom>
              Editor Crash Course
            </Typography>
            <p>Welcome, GM, to the tabletop editor.</p>
            <ul>
              <li>
                Scenes can be accessed from the{" "}
                <MenuIcon sx={{ verticalAlign: "bottom" }} /> in the top left.
              </li>
              <li>
                You can set the scene image using the{" "}
                <Map sx={{ verticalAlign: "bottom" }} /> button in the editor
                toolbar.
              </li>
              <ul>
                <li>Scenes have a player-visible image.</li>
                <li>
                  Optionally, you can also set a detailed image that includes
                  information that should not be shared with viewers.
                </li>
                <li>
                  When you have set your images, come back and edit the
                  <MenuIcon sx={{ verticalAlign: "bottom" }} /> and the scene by
                  its name.
                </li>
              </ul>
              <li>
                <Brush sx={{ verticalAlign: "bottom" }} /> will allow you to
                paint.
              </li>
              <li>
                <Rectangle sx={{ verticalAlign: "bottom" }} /> allows you to
                select regions.
              </li>
              <ul>
                <li>
                  Selected regions can be obscured &#40;
                  <VisibilityOff sx={{ verticalAlign: "bottom" }} />
                  &#41;, revealed &#40;
                  <Visibility sx={{ verticalAlign: "bottom" }} />
                  &#41; revealed, and zoomed &#40;
                  <ZoomIn sx={{ verticalAlign: "bottom" }} />
                  <ZoomOut sx={{ verticalAlign: "bottom" }} />
                  &#41;on the remote display.
                </li>
              </ul>
            </ul>
            <p>
              Using the mouse wheel you can zoom in and out on the editor. While
              painting, the mouse wheel will change the size of your brush.
            </p>
          </Paper>
        </Box>
      )}
      {scene?.playerContent && (
        <Box>
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
        </Box>
      )}
      {downloadProgress > 0 && downloadProgress < 100 && (
        <Box sx={{ margin: "-0.5em", width: `calc(100% + 1em)` }}>
          <LinearProgress variant="determinate" value={downloadProgress} />
        </Box>
      )}
    </Box>
  );
};

export default ContentEditor;
