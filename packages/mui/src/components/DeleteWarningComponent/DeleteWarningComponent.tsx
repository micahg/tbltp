import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { Asset, Token, Scene } from "@micahg/tbltp-common";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
// import styles from "./DeleteWarningComponent.module.css";

type EntityType = Asset | Token;
interface DeleteWarningComponentProps {
  open: boolean;
  deletionType: string;
  entity?: EntityType;
  handleClose: () => void;
  handleDelete: () => void;
}

const DeleteWarningComponent = ({
  open,
  deletionType,
  entity,
  handleClose,
  handleDelete,
}: DeleteWarningComponentProps) => {
  const tokens = useSelector((state: AppReducerState) => state.content.tokens);
  const scenes = useSelector((state: AppReducerState) => state.content.scenes);
  const [affectedTokens, setAffectedTokens] = useState<Token[] | undefined>(
    undefined,
  );
  const [affectedScenes, setAffectedScenes] = useState<Scene[] | undefined>(
    undefined,
  );

  const checkAsset = useCallback(
    (asset: Asset) => {
      if (!tokens) {
        console.error(`Tokens not loaded`);
        return;
      }
      // map the tokens
      const tokenMap = new Map();
      for (const token of tokens) {
        if (token.asset === asset._id && !tokenMap.has(token._id)) {
          tokenMap.set(token._id, token);
        }
      }
      setAffectedTokens(
        tokenMap.size ? Array.from(tokenMap.values()) : undefined,
      );

      // map the scenes
      const sceneMap = new Map();
      for (const scene of scenes) {
        if (scene.tokens === undefined) {
          console.error(`Scene ${scene._id} has no tokens loaded`);
          return;
        }
        for (const instance of scene.tokens) {
          if (tokenMap.has(instance.token)) {
            sceneMap.set(scene._id, scene);
            break;
          }
        }
      }
      setAffectedScenes(
        sceneMap.size ? Array.from(sceneMap.values()) : undefined,
      );
    },
    [scenes, tokens],
  );
  const checkToken = useCallback(
    (token: Token) => {
      const sceneMap = new Map();
      for (const scene of scenes) {
        if (!scene.tokens) continue;
        for (const instance of scene.tokens) {
          if (instance.token === token?._id) {
            sceneMap.set(scene._id, scene);
          }
        }
      }
      setAffectedScenes(
        sceneMap.size ? Array.from(sceneMap.values()) : undefined,
      );
      setAffectedTokens(undefined);
    },
    [scenes],
  );

  useEffect(() => {
    if (!open) return;
    if (affectedScenes === undefined && affectedTokens === undefined) {
      handleDelete();
    }
  }, [affectedScenes, affectedTokens, handleDelete, open]);
  useEffect(() => {
    if (!entity) return;
    if ((entity as Token).asset) {
      checkToken(entity as Token);
    } else {
      checkAsset(entity as Asset);
    }
  }, [checkAsset, checkToken, entity]);
  return (
    <Box>
      <Dialog open={open}>
        <DialogTitle>Delete {deletionType}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {affectedTokens && affectedTokens.length > 0 && (
              <p>
                The following tokens are still using this asset:{" "}
                {affectedTokens.map((token) => token.name).join(", ")}
              </p>
            )}
            {affectedScenes && affectedScenes.length > 0 && (
              <p>
                The following scenes are still using this asset:{" "}
                {affectedScenes.map((scene) => scene.description).join(", ")}
              </p>
            )}
          </DialogContentText>
          <DialogActions>
            <Button onClick={handleClose} autoFocus>
              Cancel
            </Button>
            <Button onClick={handleDelete}>Delete</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DeleteWarningComponent;
