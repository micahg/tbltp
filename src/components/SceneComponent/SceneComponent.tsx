// import styles from './SceneComponent.module.css';
import { Alert, Box, Button, TextField, Tooltip } from "@mui/material";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Scene } from "../../reducers/ContentReducer";
import { AppReducerState } from "../../reducers/AppReducer";
import { NewSceneBundle } from "../../middleware/ContentMiddleware";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";

const NAME_REGEX = /^[\w\s]{1,64}$/;

interface SceneComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
  redrawToolbar?: () => void;
  scene?: Scene; // scene to manage should be undefined for new
  editScene?: () => void; // callback to trigger content editor
}

// TODO use destructuring
const SceneComponent = ({
  populateToolbar,
  redrawToolbar,
  scene,
  editScene,
}: SceneComponentProps) => {
  const dispatch = useDispatch();

  /**
   * Regarding *Url, *File and *WH below, I do not love storing basically the
   * same thing three times, but there doesn't seem to be one object that holds
   * this well at thes same time. Why do we need each? URL is so we pickup the
   * changed image when the display repaints. File is for when we upload when
   * the user submits, WH is so we can show an error if the sizes don't match.
   */
  const [playerUrl, setPlayerUrl] = useState<string | undefined>(); // img src
  const [detailUrl, setDetailUrl] = useState<string | undefined>(); // img src
  const [playerFile, setPlayerFile] = useState<File | undefined>(); // upload data
  const [detailFile, setDetailFile] = useState<File | undefined>(); // upload data
  const [playerWH, setPlayerWH] = useState<number[]>([]); // img width, height
  const [detailWH, setDetailWH] = useState<number[]>([]); // img width, height
  const [playerUpdated, setPlayerUpdated] = useState<boolean>(false);
  const [detailUpdated, setDetailUpdated] = useState<boolean>(false);
  const [resolutionMismatch, setResolutionMismatch] = useState<boolean>(false);
  const [name, setName] = useState<string>();
  const [creating, setCreating] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>();
  const apiUrl = useSelector((state: AppReducerState) => state.environment.api);
  const disabledCreate =
    creating || // currently already creating or updating
    (!name && !scene) || // neither name nor scene (existing scene would have name)
    !!nameError || // dont' create with name error
    !(playerUpdated || detailUpdated) || // don't send if neither updated
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

  const selectFile = (layer: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.onchange = () => {
      if (!input.files) return;
      const file = input.files[0];
      if (layer === "detail") {
        setDetailFile(file);
        setDetailUrl(URL.createObjectURL(file));
        setDetailUpdated(true);
      } else if (layer === "player") {
        setPlayerFile(file);
        setPlayerUrl(URL.createObjectURL(file));
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
        dispatch({ type: "content/player", payload: playerFile });
        setPlayerUpdated(false);
      }
      if (detailFile && detailUpdated) {
        dispatch({ type: "content/detail", payload: detailFile });
        setDetailUpdated(false);
      }
      dispatch({ type: "content/zoom", payload: vpData });
      if (editScene) editScene();
      return;
    }
    if (!name) return; // TODO ERROR
    if (!playerFile) return; // TODO ERROR
    const data: NewSceneBundle = {
      description: name,
      player: playerFile,
      detail: detailFile,
      viewport: vpData,
    };
    dispatch({ type: "content/createscene", payload: data });
  };

  const imageLoaded = (
    name: string,
    event?: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    const img: HTMLImageElement = event?.currentTarget as HTMLImageElement;
    // to avoid waiting for set{Detail,Player}WH to rerender AND THEN compare them, just get
    // what we know NOW to do the comparison so we can also set the mismatch flag
    let a: number[], b: number[];
    if (name === "detail") {
      a = [img.naturalWidth, img.naturalHeight];
      b = playerWH;
      setDetailWH(a);
    } else if (name === "player") {
      a = [img.naturalWidth, img.naturalHeight];
      b = detailWH;
      setPlayerWH(a);
    } else return;

    if (!detailWH.length || !playerWH.length) return;

    setResolutionMismatch(a[0] !== b[0] || a[1] !== b[1]);
  };

  const syncSceneAsset = (url: string) => {
    return fetch(url)
      .then((value) => value.blob())
      .then((blob) => new File([blob], url, { type: blob.type }));
  };

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [];
    //   { icon: SaveIcon, tooltip: scene ? "Update" : "Create", hidden: () => false, disabled: () => internalState.disabledCreate, callback: updateScene}
    // ];
    // if (editScene) actions.push({ icon: EditIcon, tooltip: "Edit", hidden: () => false, disabled: () => false, callback: () => editScene()});
    populateToolbar(actions);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * If the scene comes with image assets already (it should have a player
   * visible image) then set the URL so that the <Box> image can pick it up.
   */
  useEffect(() => {
    if (scene?.detailContent) {
      setDetailUrl(`${apiUrl}/${scene.detailContent}`);
      syncSceneAsset(scene.detailContent)
        .then((file) => setDetailFile(file))
        .catch((err) =>
          console.error(
            `Unable to sync detail contenet: ${JSON.stringify(err)}`,
          ),
        );
    }
    if (scene?.playerContent) {
      setPlayerUrl(`${apiUrl}/${scene.playerContent}`);
      syncSceneAsset(scene.playerContent)
        .then((file) => setPlayerFile(file))
        .catch((err) =>
          console.error(
            `Unable to sync player content: ${JSON.stringify(err)}`,
          ),
        );
    }
  }, [apiUrl, scene]);

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
          <Box
            component="img"
            src={playerUrl}
            onClick={() => selectFile("player")}
            sx={{ width: "100%" }}
            onLoad={(e) => imageLoaded("player", e)}
          />
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
          <Box
            component="img"
            src={detailUrl}
            onClick={() => selectFile("detail")}
            sx={{ width: "100%" }}
            onLoad={(e) => imageLoaded("detail", e)}
          />
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
