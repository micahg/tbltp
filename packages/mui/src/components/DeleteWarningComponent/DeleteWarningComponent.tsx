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
import { useGetTokensQuery } from "../../api/token";
import { useGetScenesQuery } from "../../api/scene";
import { useLazyGetSceneTokenInstancesQuery } from "../../api/scenetoken";
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
  const { data: tokens = [] } = useGetTokensQuery();
  const { data: scenes = [] } = useGetScenesQuery();
  const [getSceneTokenInstances] = useLazyGetSceneTokenInstancesQuery();
  const [affectedTokens, setAffectedTokens] = useState<Token[] | undefined>(
    undefined,
  );
  const [affectedScenes, setAffectedScenes] = useState<Scene[] | undefined>(
    undefined,
  );
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const checkAsset = useCallback(
    async (asset: Asset) => {
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

      // map the scenes by checking token instances for each scene
      const sceneMap = new Map();
      for (const scene of scenes) {
        if (!scene._id) continue;
        try {
          const instances = await getSceneTokenInstances(scene._id).unwrap();
          if (instances.some((instance) => tokenMap.has(instance.token))) {
            sceneMap.set(scene._id, scene);
          }
        } catch (err) {
          console.error(`Unable to fetch scene tokens for ${scene._id}`, err);
        }
      }
      setAffectedScenes(
        sceneMap.size ? Array.from(sceneMap.values()) : undefined,
      );
      setAnalysisComplete(true);
    },
    [getSceneTokenInstances, scenes, tokens],
  );
  const checkToken = useCallback(
    async (token: Token) => {
      const sceneMap = new Map();
      for (const scene of scenes) {
        if (!scene._id) continue;
        try {
          const instances = await getSceneTokenInstances(scene._id).unwrap();
          if (instances.some((instance) => instance.token === token._id)) {
            sceneMap.set(scene._id, scene);
          }
        } catch (err) {
          console.error(`Unable to fetch scene tokens for ${scene._id}`, err);
        }
      }
      setAffectedScenes(
        sceneMap.size ? Array.from(sceneMap.values()) : undefined,
      );
      setAffectedTokens(undefined);
      setAnalysisComplete(true);
    },
    [getSceneTokenInstances, scenes],
  );

  useEffect(() => {
    if (!open) return;
    if (!analysisComplete) return;
    if (affectedScenes === undefined && affectedTokens === undefined) {
      handleDelete();
    }
  }, [affectedScenes, affectedTokens, analysisComplete, handleDelete, open]);

  useEffect(() => {
    if (!open) return;
    if (!entity) return;
    setAnalysisComplete(false);
    if ((entity as Token).asset) {
      void checkToken(entity as Token);
    } else {
      void checkAsset(entity as Asset);
    }
  }, [checkAsset, checkToken, entity, open]);
  return (
    <Box>
      <Dialog open={open}>
        <DialogTitle>Delete {deletionType}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {affectedTokens && affectedTokens.length > 0 && (
              <>
                The following tokens are still using this asset:{" "}
                {affectedTokens.map((token) => token.name).join(", ")}
                <br />
                <br />
              </>
            )}
            {affectedScenes && affectedScenes.length > 0 && (
              <>
                The following scenes are still using this asset:{" "}
                {affectedScenes.map((scene) => scene.description).join(", ")}
              </>
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
