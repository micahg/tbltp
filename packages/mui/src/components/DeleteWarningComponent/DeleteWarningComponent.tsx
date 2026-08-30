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
import { useGetScenesQuery } from "../../api/scene";
import { useLazyGetSceneTokenInstancesQuery } from "../../api/scenetoken";
import { useLazyGetAssetUsageQuery } from "../../api/asset";
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
  const { data: scenes = [] } = useGetScenesQuery();
  const [getSceneTokenInstances] = useLazyGetSceneTokenInstancesQuery();
  const [getAssetUsage] = useLazyGetAssetUsageQuery();
  const [affectedTokens, setAffectedTokens] = useState<Token[] | undefined>(
    undefined,
  );
  const [affectedScenes, setAffectedScenes] = useState<Scene[] | undefined>(
    undefined,
  );
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const checkAsset = useCallback(
    async (asset: Asset) => {
      setAnalysisComplete(false);
      if (!asset._id) {
        setAffectedTokens(undefined);
        setAffectedScenes(undefined);
        setAnalysisComplete(true);
        return;
      }
      try {
        const usage = await getAssetUsage(asset._id).unwrap();
        setAffectedTokens(usage.tokens.length > 0 ? usage.tokens : undefined);
        setAffectedScenes(usage.scenes.length > 0 ? usage.scenes : undefined);
      } catch (err) {
        console.error(`Unable to fetch asset usage for ${asset.name}`, err);
        setAffectedTokens(undefined);
        setAffectedScenes(undefined);
      }
      setAnalysisComplete(true);
    },
    [getAssetUsage],
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
    <Box data-testid="DeleteWarningComponent">
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
