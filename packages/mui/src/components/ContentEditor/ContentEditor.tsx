// trigger rebuild.
import React, {
  ReactElement,
  RefObject,
  createRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { createRect, equalRects } from "../../utils/geometry";
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
  Sync,
  Map,
  Palette,
  VisibilityOff,
  Visibility,
  Edit,
  EditOff,
  Face,
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
import {
  Rect,
  TokenInstance,
  HydratedTokenInstance,
} from "@micahg/tbltp-common";
import TokenInfoDrawerComponent from "../TokenInfoDrawerComponent/TokenInfoDrawerComponent.lazy";
import { environmentApi } from "../../api/environment";
import { useAuth0 } from "@auth0/auth0-react";

const sm = new MouseStateMachine();

interface ContentEditorProps {
  infoDrawer: (info: ReactElement) => void;
  populateToolbar?: (actions: GameMasterAction[]) => void;
  redrawToolbar?: () => void;
  manageScene?: () => void;
}

const TokenActionStrings = ["token", "move_token", "delete_token"];
type SelectAction = "select";
type TokenActions = (typeof TokenActionStrings)[number];
type BrushAction = "paint" | "erase" | TokenActions;
type RecordingAction = "move" | SelectAction | BrushAction;

// hack around rerendering -- keep one object in state and update properties
// so that the object itself remains unchanged.
interface InternalState {
  color: RefObject<HTMLInputElement>;
  selected: boolean;
  zoom: boolean;
  act: RecordingAction;
  rec: boolean;
  transferred: boolean;
}

const ContentEditor = ({
  populateToolbar,
  redrawToolbar,
  manageScene,
  infoDrawer,
}: ContentEditorProps) => {
  const dispatch = useDispatch();
  const contentCanvasRef = createRef<HTMLCanvasElement>();
  const overlayCanvasRef = createRef<HTMLCanvasElement>();
  const colorInputRef = createRef<HTMLInputElement>();

  const [internalState] = useState<InternalState>({
    zoom: false,
    selected: false,
    color: createRef(),
    act: "move",
    rec: false,
    transferred: false,
  });
  const [showBackgroundMenu, setShowBackgroundMenu] = useState<boolean>(false);
  const [showOpacityMenu, setShowOpacityMenu] = useState<boolean>(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState<boolean>(false);
  const [opacitySliderVal, setOpacitySliderVal] = useState<number>(1);
  const [imageSize, setImageSize] = useState<number[] | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [bgRev, setBgRev] = useState<number>(0);
  const [ovRev, setOvRev] = useState<number>(0);
  const [sceneId, setSceneId] = useState<string>(); // used to track flipping between scenes
  const [worker, setWorker] = useState<Worker>();
  const [sceneUpdated, setSceneUpdated] = useState<boolean>(false);
  const [downloads] = useState<Record<string, number>>({});
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  // selection is sized relative to the visible canvas size -- not the full background size
  const [selection, setSelection] = useState<Rect | null>(null);
  const [bearer, setBearer] = useState<string | null>(null);

  // the viewport to draw so the dm knows what the players see
  const [displayViewport, setDisplayViewport] = useState<Rect | null>(null);

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
  const apiUrl = useSelector(
    (state: AppReducerState) =>
      environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api,
  );
  const pushTime = useSelector(
    (state: AppReducerState) => state.content.pushTime,
  );

  const { getAccessTokenSilently } = useAuth0();

  const updateSelected = useCallback(
    (value: boolean) => {
      if (internalState.selected !== value && redrawToolbar) {
        internalState.selected = value;
        redrawToolbar();
      }
    },
    [internalState, redrawToolbar],
  );

  const updateRecording = useCallback(
    (value: boolean) => {
      if (internalState.rec !== value && redrawToolbar) {
        internalState.rec = value;
        if (!value) {
          internalState.act = "move";
        }
        redrawToolbar();
      }
    },
    [internalState, redrawToolbar],
  );

  /**
   * Set the action in preparation of recording callbacks from the state machine
   */
  const prepareRecording = useCallback(
    (action: RecordingAction) => {
      internalState.rec = false;
      internalState.selected = false;
      internalState.act = action;
      sm.transition("record");
    },
    [internalState],
  );

  const sceneManager = useCallback(() => {
    if (manageScene) manageScene();
  }, [manageScene]);

  const setToken = useCallback(
    (token: HydratedTokenInstance) => {
      if (!worker) return;
      worker.postMessage({ cmd: "set_token", token: token, bearer: bearer });
    },
    [worker, bearer],
  );

  const gmSelectColor = useCallback(() => {
    if (!internalState.color.current) return;
    const ref = internalState.color.current;
    ref.focus();
    ref.click();
  }, [internalState.color]);

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

  const handleMouseMove = useCallback(
    (buttons: number, x: number, y: number) => {
      if (!worker) return;
      if (!internalState.rec) return;
      worker.postMessage({
        cmd: internalState.act,
        buttons: buttons,
        x: x,
        y: y,
      });
    },
    [worker, internalState.rec, internalState.act],
  );

  /**
   * This method doesn't have access to the updated component state *BECAUSE*
   * its
   */
  const handleWorkerMessage = useCallback(
    (evt: MessageEvent<unknown>) => {
      console.log(evt);
      if (!scene?._id) return;
      if (!evt.data || typeof evt.data !== "object") return;
      if (!("cmd" in evt.data)) return;
      if (evt.data.cmd === "updated") {
        setSceneUpdated(true);
      } else if (evt.data.cmd === "overlay") {
        if ("blob" in evt.data) {
          setOvRev(ovRev + 1);
          dispatch({ type: "content/overlay", payload: evt.data.blob });
        } else console.error("Error: no blob in worker message");
      } else if (evt.data.cmd === "viewport") {
        if ("viewport" in evt.data) {
          const vp = evt.data.viewport;
          dispatch({ type: "content/zoom", payload: { viewport: vp } });
        } else console.error("No viewport in worker message");
      } else if (evt.data.cmd === "resized") {
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
      } else if (evt.data.cmd === "token_placed") {
        if (!("instance" in evt.data)) return;
        dispatch({
          type: "content/scenetokenplaced",
          payload: evt.data.instance,
        });
      } else if (evt.data.cmd === "token_deleted") {
        if (!("instance" in evt.data)) return;
        dispatch({
          type: "content/scenetokendeleted",
          payload: evt.data.instance,
        });
      } else if (evt.data.cmd === "token_moved") {
        if (!("instance" in evt.data)) return;
        dispatch({
          type: "content/scenetokenmoved",
          payload: evt.data.instance,
        });
      }
    },
    [dispatch, downloads, ovRev, scene],
  );

  /**
   * Send drawables to the worker to render on the canvas
   */
  const handleDrawables = useCallback(() => {
    if (!scene) return;
    if (!worker) return;
    if (!apiUrl) return;
    if (!bearer) return;

    // we cannot pre-translate these into drawables because properties
    // that are methods do not survive the transfer to the worker
    const things: (TokenInstance | Rect)[] = scene.tokens
      ? [...scene.tokens]
      : [];
    if (
      scene.viewport &&
      scene.backgroundSize &&
      !equalRects(scene.viewport, scene.backgroundSize)
    )
      things.push(scene.viewport);

    // scene.tokens?.forEach((token) => things.push(token));
    // need to delay this until we know we're in a good state.
    worker.postMessage({ cmd: "things", values: { apiUrl, bearer, things } });
  }, [apiUrl, bearer, worker, scene]);

  useEffect(() => {
    if (!internalState || !toolbarPopulated) return;
    internalState.color = colorInputRef;
  }, [internalState, colorInputRef, toolbarPopulated]);

  useEffect(() => {
    getAccessTokenSilently()
      .then((token) => setBearer(token))
      .catch(() => setBearer(null));
  }, [getAccessTokenSilently]);

  /**
   * Populate the toolbar with our actions. Empty deps insures this only gets
   */
  useEffect(() => {
    if (!populateToolbar) return;
    if (!worker) return;
    if (!bearer) return; // fetching token images requires a bearer token
    if (!apiUrl) return; // fetching token images requires an API

    const actions: GameMasterAction[] = [
      {
        icon: Sync,
        tooltip: "Sync Remote Display",
        hidden: () => false,
        disabled: () => internalState.rec || internalState.act !== "move",
        callback: () => sm.transition("push"),
      },
      {
        icon: Map,
        tooltip: "Scene Backgrounds",
        hidden: () => false,
        disabled: () => internalState.rec || internalState.act !== "move",
        callback: sceneManager,
      },
      {
        icon: Palette,
        tooltip: "Color Palette",
        hidden: () => false,
        disabled: () => internalState.rec || internalState.act !== "move",
        callback: gmSelectColor,
      },
      {
        icon: LayersClear,
        tooltip: "Clear Overlay",
        hidden: () => false,
        disabled: () => internalState.rec || internalState.act !== "move",
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
        disabled: () => internalState.rec || internalState.selected,
        callback: () => sm.transition("remoteZoomOut"),
      },
      {
        icon: Opacity,
        tooltip: "Opacity",
        hidden: () => false,
        disabled: () => internalState.rec || internalState.act === "select",
        callback: (evt) => gmSelectOpacityMenu(evt),
      },
      {
        icon: RotateRight,
        tooltip: "Rotate",
        hidden: () => false,
        disabled: () => internalState.rec || internalState.act === "select",
        callback: () => sm.transition("rotateClock"),
      },
      {
        icon: Face,
        tooltip: "Token",
        hidden: () =>
          internalState.rec && TokenActionStrings.includes(internalState.act),
        disabled: () =>
          internalState.rec && !TokenActionStrings.includes(internalState.act),
        callback: () =>
          infoDrawer(
            <TokenInfoDrawerComponent
              onToken={(token: HydratedTokenInstance) => {
                setToken(token);
                prepareRecording("token");
              }}
              onDelete={() => prepareRecording("delete_token")}
              onMove={() => prepareRecording("move_token")}
            />,
          ),
      },
      {
        icon: Face,
        tooltip: "Finish Token",
        hidden: () =>
          !(
            internalState.rec && TokenActionStrings.includes(internalState.act)
          ),
        disabled: () => false,
        callback: () => sm.transition("wait"),
      },
      {
        icon: EditOff,
        tooltip: "Erase",
        hidden: () => internalState.rec && internalState.act === "erase",
        disabled: () => internalState.rec && internalState.act !== "erase",
        callback: () => prepareRecording("erase"),
      },
      {
        icon: EditOff,
        tooltip: "Finish Erase",
        emphasis: true,
        hidden: () => !(internalState.rec && internalState.act === "erase"),
        disabled: () => false,
        callback: () => sm.transition("wait"),
      },
      {
        icon: Edit,
        tooltip: "Paint",
        hidden: () => internalState.rec && internalState.act === "paint",
        disabled: () => internalState.rec && internalState.act !== "paint",
        callback: () => prepareRecording("paint"),
      },
      {
        icon: Edit,
        tooltip: "Finish Paint",
        emphasis: true,
        hidden: () => !(internalState.rec && internalState.act === "paint"),
        disabled: () => false,
        callback: () => sm.transition("wait"),
      },
      {
        icon: Rectangle,
        tooltip: "Select",
        hidden: () => internalState.rec && internalState.act === "select",
        disabled: () => internalState.rec && internalState.act !== "select",
        callback: () => prepareRecording("select"),
      },
      {
        icon: Rectangle,
        tooltip: "Finish Select",
        emphasis: true,
        hidden: () => !(internalState.rec && internalState.act === "select"),
        disabled: () => false,
        callback: () => sm.transition("wait"),
      },
    ];
    populateToolbar(actions);
    setToolbarPopulated(true);
  }, [
    apiUrl,
    bearer,
    gmSelectColor,
    infoDrawer,
    internalState.act,
    internalState.rec,
    internalState.selected,
    internalState.zoom,
    populateToolbar,
    prepareRecording,
    sceneManager,
    setToken,
    worker,
  ]);

  useEffect(() => {
    if (!scene || !scene.viewport || !scene.backgroundSize) return;
    if (!worker) return;
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
  }, [scene, internalState, redrawToolbar, worker]);

  useEffect(() => {
    /**
     * For now, we do want to run this every render, because we need
     * updated state for some of the callbacks (eg: rotation).
     */
    if (!overlayCanvasRef.current) return;
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
      updateRecording(false);
      // state machine for paint loops from complete back to paint to prevent having to click
      // the paint button every time. So, now we know we're *really* done, make sure the worker
      // knows too and stops recording mouse events
      worker.postMessage({ cmd: "wait" });
    });

    setCallback(sm, "record", () => {
      // skip if we're already recording
      if (internalState.rec) return;
      setShowBackgroundMenu(false);
      setShowOpacityMenu(false);
      setShowOpacitySlider(false);
      updateRecording(true);
    });
    setCallback(sm, "background_select", () => {
      sm.resetCoordinates();
      updateSelected(false);
      setShowBackgroundMenu(true);
    });
    setCallback(sm, "background_link", () => {
      setShowBackgroundMenu(false);
    });
    setCallback(sm, "background_upload", sceneManager);
    setCallback(sm, "obscure", () => {
      worker.postMessage({ cmd: "obscure", rect: selection });
      sm.transition("obscured");
    });
    setCallback(sm, "reveal", () => {
      worker.postMessage({ cmd: "reveal", rect: selection });
      sm.transition("revealed");
    });
    setCallback(sm, "remoteZoomIn", () => {
      if (!worker) return;
      sm.transition("zoomed");
      updateSelected(false);
      worker.postMessage({ cmd: "zoom", rect: selection });
    });
    setCallback(sm, "remoteZoomOut", () => {
      const imgRect = createRect([0, 0, imageSize[0], imageSize[1]]);
      dispatch({
        type: "content/zoom",
        payload: { backgroundSize: imgRect, viewport: imgRect },
      });
    });
    setCallback(sm, "complete", () => {
      if (!internalState.rec) {
        console.error(`complete CALLBACK in non-recording state`);
        return;
      }
      if (internalState.act === "select") {
        worker.postMessage({ cmd: "end_select" });
        updateSelected(true);
      } else if (
        internalState.act === "erase" ||
        internalState.act === "paint" ||
        TokenActionStrings.includes(internalState.act)
      ) {
        worker.postMessage({ cmd: `end_${internalState.act}` });
        sm.transition("record");
      } else if (internalState.act === "move") {
        worker.postMessage({ cmd: "end_panning" });
        sm.transition("wait");
      } else {
        console.error(
          `RECORDING COMPLETE IN INVALID STATE: ${internalState.act}`,
        );
      }
    });
    setCallback(sm, "opacity_select", () => {
      sm.resetCoordinates();
      updateSelected(false);
      setShowOpacityMenu(true);
    });
    setCallback(sm, "opacity_display", () => {
      setShowOpacityMenu(false);
      if (overlayCanvasRef.current) {
        const style = getComputedStyle(overlayCanvasRef.current);
        setOpacitySliderVal(Number(style.opacity) || 1);
      }
      setShowOpacitySlider(true);
    });
    setCallback(sm, "opacity_render", () => {
      setShowOpacityMenu(false);
      // update default opacity to render opacity... might take more effort
      setOpacitySliderVal(1);
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
    setCallback(sm, "select", () => updateSelected(false));
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
      if (
        internalState.rec &&
        (internalState.act === "erase" ||
          internalState.act === "paint" ||
          internalState.act === "token")
      ) {
        sm.transition("done");
        const e: WheelEvent = args[0] as WheelEvent;
        if (e.deltaY > 0) {
          worker.postMessage({
            cmd: "brush_inc",
            x: e.offsetX,
            y: e.offsetY,
            action: internalState.act,
          });
        } else if (e.deltaY < 0) {
          worker.postMessage({
            cmd: "brush_dec",
            x: e.offsetX,
            y: e.offsetY,
            action: internalState.act,
          });
        } else if (e.deltaX !== 0) {
          worker.postMessage({
            cmd: "brush_rot",
            delta: e.deltaX,
            action: internalState.act,
          });
        }
      } else if (
        internalState.rec &&
        (internalState.act === "select" || internalState.act === "move")
      ) {
        // ignore wheel on select or while panning (move)
        sm.transition("done");
      }
    });
    setCallback(sm, "rotate_clock", () => {
      const angle = ((scene.angle || 0) + 90) % 360;
      worker.postMessage({ cmd: "rotate", angle: angle });
      dispatch({ type: "content/zoom", payload: { angle: angle } });
      sm.transition("done");
    });
  }, [
    dispatch,
    imageSize,
    sceneManager,
    handleMouseMove,
    updateSelected,
    scene,
    overlayCanvasRef,
    worker,
    internalState,
    selection,
    updateRecording,
  ]);

  /**
   * This is the main rendering loop. Its a bit odd looking but we're working really hard to avoid repainting
   * when we don't have to. We should only repaint when a scene changes OR an asset version has changed
   */
  useEffect(() => {
    if (!apiUrl || !scene || !bearer || !worker) return;

    // get the detailed or player content
    const [bRev, bContent] = [
      scene.detailContentRev || scene.playerContentRev || 0,
      scene.detailContent || scene.playerContent,
    ];
    const [oRev, oContent] = [
      scene.overlayContentRev || 0,
      scene.overlayContent,
    ];

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
      const overlay = drawOV ? `${apiUrl}/${oContent}` : undefined;
      const background = drawBG ? `${apiUrl}/${bContent}` : undefined;

      const angle = scene.angle || 0;

      worker.postMessage({
        cmd: "update",
        values: {
          background,
          overlay,
          bearer,
          angle,
        },
      });
    }
  }, [apiUrl, bearer, bgRev, ovRev, scene, sceneId, worker]);

  /**
   * We don't want to render the viewport until it changes in current scene server-side
   * so we detect it here and then update the worker to redraw the viewport.
   */
  useEffect(() => {
    if (!scene) return;
    if (!sceneId) return;
    if (!scene.viewport) return;
    if (!worker) return;
    if (!sceneUpdated) return;

    // we *ONLY* care about the viewport changing in the context of the same scene
    // otherwise, it should be rendered by the scene change.
    if (!sceneId || scene._id !== sceneId) return;

    // if the viewport has not *actually* changed, then we don't care
    if (displayViewport !== null && equalRects(scene.viewport, displayViewport))
      return;

    // at this point, we know the viewport has changed and we need to update the worker...
    setDisplayViewport(scene.viewport);

    // draw the viewport (and possibly tokens) to the canvas
    handleDrawables();
  }, [displayViewport, scene, sceneId, worker, sceneUpdated, handleDrawables]);

  /**
   * Wait for tokens to be changed in the scene, then render them
   */
  useEffect(() => {
    if (!scene) return;
    if (!dispatch) return;
    if (!sceneUpdated) return;

    // draw the viewport (and possibly tokens) to the canvas
    if (scene.tokens && handleDrawables) {
      handleDrawables();
      return;
    }

    // if there are no tokens, set them in the scene so they can be drawn
    dispatch({ type: "content/scenetokens", payload: { scene: scene._id } });
  }, [dispatch, scene, sceneUpdated, handleDrawables]);

  /**
   * Its important to separate the worker message handler from the
   * worker creation *because* the handler is a callback that
   * depends on state that changes over time. The worker is setup
   * once when we initialize the canvas.
   */
  useEffect(() => {
    if (!worker) return;
    if (!handleWorkerMessage) return;
    worker.addEventListener("message", handleWorkerMessage);
    return () => {
      worker.removeEventListener("message", handleWorkerMessage);
    };
  }, [worker, handleWorkerMessage]);

  /**
   * Setup the web worker -- this should only happen once and the canvas
   * should live on for the life of the component.
   */
  useEffect(() => {
    /**
     * the canvas refs are not really reliable indicators of our state. They
     * change more than once after we are setup. To avoid setting up duplicate
     * event listeners and handlers, we're using the internal state to exit if
     * the canvas has already been transferred.
     */
    const bg = contentCanvasRef.current;
    const ov = overlayCanvasRef.current;
    if (!bg || !ov || internalState.transferred) {
      return;
    }

    const wrkr = setupOffscreenCanvas(bg, ov, true);
    setWorker(wrkr);
    internalState.transferred = true;
    ov.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ov.addEventListener("mousedown", (e) => sm.transition("down", e));
    ov.addEventListener("mouseup", (e) => sm.transition("up", e));
    ov.addEventListener("mousemove", (e) => sm.transition("move", e));
    ov.addEventListener("wheel", (e) => sm.transition("wheel", e));

    // watch for canvas size changes and report to worker
    const handleResizeEvent = debounce(async (e: ResizeObserverEntry[]) => {
      const [w, h] = [e[0].contentRect.width, e[0].contentRect.height];
      if (w === 0 && h === 0) return; // when the component is hidden or destroyed
      wrkr.postMessage({ cmd: "resize", width: w, height: h });
    }, 250);
    const observer = new ResizeObserver((e) => handleResizeEvent(e));
    observer.observe(ov);

    /**
     * Good form would have us cleanup our worker and event listeners -- but here is the
     * thing Micah will almost certainly forget in a month. Once we create the worker, it
     * basically lives forever until our window or tab is closed. This has been tested
     * using a counter that increments every "init" -- it goes up. So basically we just
     * pass these canvasses over once, and make sure we don't setup their event listeners
     * more than once.
     */
  }, [contentCanvasRef, handleWorkerMessage, internalState, overlayCanvasRef]);

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
                <Edit sx={{ verticalAlign: "bottom" }} /> will allow you to
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
                defaultValue={opacitySliderVal}
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
