import styles from "./SceneComponent.module.css";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import { createRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
import { LoadProgress, loadImage } from "../../utils/content";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent.lazy";
import { Scene } from "@micahg/tbltp-common";
import { environmentApi } from "../../api/environment";
import { useAuth0 } from "@auth0/auth0-react";
import { saveSceneFlow } from "../../thunks/createSceneFlow";
import {
  useAssignSceneLayerAssetMutation,
  useCreateSceneMutation,
  useDeleteSceneMutation,
  useUpdateSceneViewportMutation,
} from "../../api/scene";
import {
  useDeleteAssetMutation,
  useGetAssetByIdQuery,
  useUpdateAssetDataMutation,
  useUpdateAssetMutation,
} from "../../api/asset";
import {
  clearEditingSceneId,
  selectEditorUiError,
  setError,
  setEditingSceneId,
} from "../../slices/editorUiSlice";
import { skipToken } from "@reduxjs/toolkit/query";

// TODO move to a shared file
export const NAME_REGEX = /^[\w\s]{1,64}$/;

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
  const apiUrl = useSelector(
    (state: AppReducerState) =>
      environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api,
  );
  const error = useSelector(selectEditorUiError);
  const { getAccessTokenSilently } = useAuth0();
  const [createScene] = useCreateSceneMutation();
  const [updateAsset] = useUpdateAssetMutation();
  const [updateAssetData] = useUpdateAssetDataMutation();
  const [assignSceneLayerAsset] = useAssignSceneLayerAssetMutation();
  const [updateSceneViewport] = useUpdateSceneViewportMutation();
  const [deleteScene] = useDeleteSceneMutation();
  const [deleteAsset] = useDeleteAssetMutation();
  const { data: playerAsset } = useGetAssetByIdQuery(
    scene?.playerId ?? skipToken,
  );
  const { data: detailAsset } = useGetAssetByIdQuery(
    scene?.detailId ?? skipToken,
  );
  const [bearer, setBearer] = useState<string | null>(null);
  const hasUpdates = playerUpdated || detailUpdated;

  const disabledCreate =
    creating || // currently already creating or updating
    (!name && !scene) || // neither name nor scene (existing scene would have name)
    (!scene && !playerFile) || // new scene requires a player layer
    !!nameError || // don't create with name error
    (!!scene && !hasUpdates) || // only require image changes when editing
    error !== undefined ||
    (!!scene && resolutionMismatch); // only block edit flow on resolution mismatch
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
          const detailRatio = Math.round((100 * i.width) / i.height);
          const playerRatio = Math.round((100 * b[0]) / b[1]);
          renderImage(i, dCanvas);
          setDetailWH(a);
          setResolutionMismatch(
            !Number.isNaN(playerRatio) && detailRatio !== playerRatio,
          );
        });
        setDetailFile(file);
        setDetailUpdated(true);
      } else if (layer === "player") {
        createImageBitmap(file).then((i) => {
          const a = [i.width, i.height];
          const b = detailWH;
          const playerRatio = Math.round((100 * i.width) / i.height);
          const detailRatio = Math.round((100 * b[0]) / b[1]);
          setPlayerWH(a);
          renderImage(i, pCanvas);
          setResolutionMismatch(
            !Number.isNaN(detailRatio) && detailRatio !== playerRatio,
          );
        });
        setPlayerFile(file);
        setPlayerUpdated(true);
      } else console.error("Invalid layer");
    };
    input.click();
  };

  const updateScene = async () => {
    setCreating(true);
    // Only set viewport on create; existing scenes already have one.
    const rect = { x: 0, y: 0, width: playerWH[0], height: playerWH[1] };
    const vpData = { backgroundSize: rect, viewport: rect };
    if (!scene && (!name || !playerFile)) {
      setCreating(false);
      return; // TODO ERROR
    }

    saveSceneFlow(
      {
        scene,
        description: name,
        player: scene ? (playerUpdated ? playerFile : undefined) : playerFile,
        detail: scene ? (detailUpdated ? detailFile : undefined) : detailFile,
        viewport: scene ? undefined : vpData,
        playerProgress: playerProgressHandler,
        detailProgress: detailProgressHandler,
      },
      {
        createScene: (payload) => createScene(payload).unwrap(),
        updateAsset: (payload) => updateAsset(payload).unwrap(),
        updateAssetData: (payload) => updateAssetData(payload).unwrap(),
        assignSceneLayerAsset: (payload) =>
          assignSceneLayerAsset(payload).unwrap(),
        updateSceneViewport: (payload) => updateSceneViewport(payload).unwrap(),
        deleteScene: (sceneId) => deleteScene(sceneId).unwrap(),
        deleteAsset: (asset) => deleteAsset(asset).unwrap(),
        onScene: (nextScene) => dispatch(setEditingSceneId(nextScene._id)),
        onSuccess: () =>
          dispatch(setError({ msg: "Update successful", success: true })),
        onFailure: (message) =>
          dispatch(setError({ msg: message, success: false })),
        onClearCurrentScene: () => dispatch(clearEditingSceneId()),
      },
    )
      .then(() => {
        setPlayerUpdated(false);
        setDetailUpdated(false);
        setCreating(false);
      })
      .catch(() => {
        // banner/error state is handled by createSceneFlow callbacks
        setCreating(false);
      });
  };

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [];
    populateToolbar(actions);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getAccessTokenSilently()
      .then((token) => setBearer(token))
      .catch(() => setBearer(null));
  }, [getAccessTokenSilently]);

  useEffect(() => {
    if (!error || !dispatch) return;

    // error feedback means creation (success or failure) is done
    setCreating(false);

    // on success, clear the banner eventually
    if (error.success) {
      const id = setTimeout(() => dispatch(setError(undefined)), 5000);
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
    if (!scene?.playerId && scene?.playerContent) {
      console.error("SCENE MISSING PLAYER ID"); // this should never happen, but just in case
    }
    const playerContent = scene?.playerId
      ? playerAsset?.location || scene.playerContent
      : scene?.playerContent;
    if (playerContent) {
      const url = `${apiUrl}/${playerContent}`;
      loadImage(url, bearer, playerProgressHandler).then((img) => {
        renderImage(img, canvas);
      });
    }
  }, [apiUrl, bearer, loadingPlayer, playerCanvasRef, scene, playerAsset]);
  useEffect(() => {
    const canvas = detailCanvasRef?.current;
    if (!bearer || !apiUrl || !canvas || loadingDetail) return;
    setLoadingDetail(true);
    if (!scene?.detailId && scene?.detailContent) {
      console.error("SCENE MISSING DETAIL ID"); // this should never happen, but just in case
    }
    const detailContent = scene?.detailId
      ? detailAsset?.location || scene.detailContent
      : scene?.detailContent;
    if (detailContent) {
      const url = `${apiUrl}/${detailContent}`;
      loadImage(url, bearer, detailProgressHandler).then((img) => {
        renderImage(img, canvas);
      });
    }
  }, [apiUrl, bearer, detailCanvasRef, scene, loadingDetail, detailAsset]);

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
        onChange={(
          event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
        ) => handleNameChange(event)}
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
