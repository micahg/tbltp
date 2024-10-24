import styles from "./SceneComponent.module.css";
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import { createRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Scene } from "../../reducers/ContentReducer";
import { AppReducerState } from "../../reducers/AppReducer";
import { NewSceneBundle } from "../../middleware/ContentMiddleware";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { LoadProgress, loadImage } from "../../utils/content";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent.lazy";

const NAME_REGEX = /^[\w\s]{1,64}$/;

interface SceneComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
  redrawToolbar?: () => void;
  scene?: Scene; // scene to manage should be undefined for new
  editScene?: () => void; // callback to trigger content editor
}

// TODO use destructuring
const SceneComponent = ({ populateToolbar, scene }: SceneComponentProps) => {
  const dispatch = useDispatch();

  const playerCanvasRef = createRef<HTMLCanvasElement>();
  const detailCanvasRef = createRef<HTMLCanvasElement>();

  /**
   * Regarding *Url, *File and *WH below, I do not love storing basically the
   * same thing three times, but there doesn't seem to be one object that holds
   * this well at the same time. Why do we need each? URL is so we pickup the
   * changed image when the display repaints. File is for when we upload when
   * the user submits, WH is so we can show an error if the sizes don't match.
   */
  const [playerFile, setPlayerFile] = useState<File | undefined>(); // upload data
  const [detailFile, setDetailFile] = useState<File | undefined>(); // upload data
  const [playerWH, setPlayerWH] = useState<number[]>([]); // img width, height
  const [detailWH, setDetailWH] = useState<number[]>([]); // img width, height
  const [playerUpdated, setPlayerUpdated] = useState<boolean>(false);
  const [detailUpdated, setDetailUpdated] = useState<boolean>(false);
  const [resolutionMismatch, setResolutionMismatch] = useState<boolean>(false);
  const [name, setName] = useState<string>();
  const [creating, setCreating] = useState<boolean>(false);
  const [loadingPlayer, setLoadingPlayer] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>();
  const [playerProgress, setPlayerProgress] = useState<number>(0);
  const [detailProgress, setDetailProgress] = useState<number>(0);
  const apiUrl = useSelector((state: AppReducerState) => state.environment.api);
  const error = useSelector((state: AppReducerState) => state.content.err);
  const bearer = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );

  const disabledCreate =
    creating || // currently already creating or updating
    (!name && !scene) || // neither name nor scene (existing scene would have name)
    !!nameError || // don't create with name error
    !(playerUpdated || detailUpdated) || // don't send if neither updated
    error !== undefined ||
    resolutionMismatch; // for now, don't send on resolution mismatch
  // we should probably send if resolution is different but aspect ratio same

  const handleNameChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    setName(event.target.value);
    const match = NAME_REGEX.test(event.target.value);
    if (event.target.value && match && nameError) {
      setNameError(undefined);
    } else if (!match && !nameError) {
      setNameError("Invalid scene name");
    }
  };

  const playerProgressHandler = (event: LoadProgress) =>
    setPlayerProgress(event.progress ? event.progress * 100 : 0);

  const detailProgressHandler = (event: LoadProgress) =>
    setDetailProgress(event.progress ? event.progress * 100 : 0);

  const selectFile = (layer: string) => {
    const dCanvas = detailCanvasRef?.current;
    const pCanvas = playerCanvasRef?.current;
    if (!dCanvas) return;
    if (!pCanvas) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.onchange = () => {
      if (!input.files) return;
      const file = input.files[0];
      if (layer === "detail") {
        createImageBitmap(file).then((i) => {
          const a = [i.width, i.height];
          const b = playerWH;
          renderImage(i, dCanvas);
          setDetailWH(a);
          setResolutionMismatch(
            b.length === 2 && (a[0] !== b[0] || a[1] !== b[1]),
          );
        });
        setDetailFile(file);
        setDetailUpdated(true);
      } else if (layer === "player") {
        createImageBitmap(file).then((i) => {
          const a = [i.width, i.height];
          const b = detailWH;
          setPlayerWH(a);
          renderImage(i, pCanvas);
          setResolutionMismatch(
            b.length === 2 && (a[0] !== b[0] || a[1] !== b[1]),
          );
        });
        setPlayerFile(file);
        setPlayerUpdated(true);
      } else console.error("Invalid layer");
    };
    input.click();
  };

  const updateScene = () => {
    setCreating(true);
    // if we are changing any images reset the viewport
    const rect = { x: 0, y: 0, width: playerWH[0], height: playerWH[1] };
    const vpData = { backgroundSize: rect, viewport: rect };
    if (scene) {
      // TODO clear overlay
      if (playerFile && playerUpdated) {
        const payload = { asset: playerFile, progress: playerProgressHandler };
        dispatch({ type: "content/player", payload: payload });
        setPlayerUpdated(false);
      }
      if (detailFile && detailUpdated) {
        const payload = { asset: detailFile, progress: detailProgressHandler };
        dispatch({ type: "content/detail", payload: payload });
        setDetailUpdated(false);
      }
      dispatch({ type: "content/zoom", payload: vpData });
      return;
    }
    if (!name) return; // TODO ERROR
    if (!playerFile) return; // TODO ERROR
    const data: NewSceneBundle = {
      description: name,
      player: playerFile,
      detail: detailFile,
      viewport: vpData,
      playerProgress: playerProgressHandler,
      detailProgress: detailProgressHandler,
    };
    dispatch({ type: "content/createscene", payload: data });
  };

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [];
    populateToolbar(actions);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!error || !dispatch) return;

    // error feedback means creation (success or failure) is done
    setCreating(false);

    // on success, clear the banner eventually
    if (error.success) {
      const id = setTimeout(() => dispatch({ type: "content/error" }), 5000);
      return () => clearTimeout(id);
    }
  }, [dispatch, error]);

  function renderImage(i: ImageBitmap, canvas: HTMLCanvasElement) {
    const w = canvas.width;
    const h = (i.height * w) / i.width;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(i, 0, 0, w, h);
  }
  /**
   * If the scene comes with image assets already (it should have a player
   * visible image) then set the URL so that the <Box> image can pick it up.
   * Don't bother fetching the files more than once though - they don't change
   * and doing so causes rendering issues and wastes bandwidth (if there was a
   * change, its because we'd have just uploaded, we don't need to download it)
   */
  useEffect(() => {
    const canvas = playerCanvasRef?.current;
    if (!bearer || !apiUrl || !canvas || loadingPlayer) return;
    setLoadingPlayer(true);
    if (scene?.playerContent) {
      const url = `${apiUrl}/${scene.playerContent}`;
      loadImage(url, bearer, playerProgressHandler).then((img) => {
        renderImage(img, canvas);
      });
    }
  }, [apiUrl, bearer, loadingPlayer, playerCanvasRef, scene]);
  useEffect(() => {
    const canvas = detailCanvasRef?.current;
    if (!bearer || !apiUrl || !canvas || loadingDetail) return;
    setLoadingDetail(true);
    if (scene?.detailContent) {
      const url = `${apiUrl}/${scene.detailContent}`;
      loadImage(url, bearer, detailProgressHandler).then((img) => {
        renderImage(img, canvas);
      });
    }
  }, [apiUrl, bearer, detailCanvasRef, scene, loadingDetail]);

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        gap: "1em",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {resolutionMismatch && (
        <Alert severity="error">
          Image resolution does not match (they must match).
        </Alert>
      )}
      <ErrorAlertComponent />
      <TextField
        disabled={!!scene}
        id="standard-basic"
        label="Scene Name"
        variant="standard"
        defaultValue={scene?.description}
        helperText={nameError}
        error={!!nameError}
        onChange={(event) => handleNameChange(event)}
      ></TextField>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          gap: "1em",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxShadow: 4,
            borderRadius: 2,
            padding: 1,
            minHeight: "25vh",
            width: "25vw",
          }}
        >
          <canvas
            onClick={() => selectFile("player")}
            ref={playerCanvasRef}
            className={styles.canvas}
          />
          {playerProgress > 0 && playerProgress < 100 && (
            <LinearProgress variant="determinate" value={playerProgress} />
          )}
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxShadow: 4,
            borderRadius: 2,
            padding: 1,
            minHeight: "25vh",
            width: "25vw",
          }}
        >
          <canvas
            onClick={() => selectFile("detail")}
            ref={detailCanvasRef}
            className={styles.canvas}
          />
          {detailProgress > 0 && detailProgress < 100 && (
            <LinearProgress variant="determinate" value={detailProgress} />
          )}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          gap: "1em",
        }}
      >
        <Tooltip title="The background players see">
          <span>
            <Button variant="outlined" onClick={() => selectFile("player")}>
              Player Background
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="A background only you, the use, sees (should be the same size as the table background)">
          <span>
            <Button variant="outlined" onClick={() => selectFile("detail")}>
              Detailed Background
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          gap: "1em",
        }}
      >
        <Tooltip title="Create the scene">
          <span>
            <Button
              variant="contained"
              disabled={disabledCreate}
              onClick={() => updateScene()}
            >
              {scene ? "Update" : "Create"}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default SceneComponent;
