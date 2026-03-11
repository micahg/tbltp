import {
  Box,
  List,
  ListItem,
  TextField,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Tooltip,
} from "@mui/material";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { AppReducerState } from "../../reducers/AppReducer";
import { useSelector } from "react-redux";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { HydratedTokenInstance, Token } from "@micahg/tbltp-common";
import { useAuth0 } from "@auth0/auth0-react";
import { useGetScenesQuery } from "../../api/scene";
import { selectEditingSceneId } from "../../slices/editorUiSlice";
import { useGetTokensQuery } from "../../api/token";
import { useGetAssetsQuery } from "../../api/asset";
import { environmentApi } from "../../api/environment";
// import styles from "./FindTokenComponent.module.css";

interface FindTokenComponentProps {
  // onToken: (token: HydratedToken) => void;
  onToken: (token: HydratedTokenInstance) => void;
}

const FindTokenComponent = ({ onToken }: FindTokenComponentProps) => {
  const { data: tokens = [] } = useGetTokensQuery();
  const { data: assets = [] } = useGetAssetsQuery();
  const { data: scenes = [] } = useGetScenesQuery();
  const editingSceneId = useSelector(selectEditingSceneId);
  const scene = scenes.find((s) => s._id === editingSceneId);
  const api = useSelector(
    (state: AppReducerState) =>
      environmentApi.endpoints.getEnvironmentConfig.select()(state).data?.api,
  );
  const { getAccessTokenSilently } = useAuth0();
  const [bearer, setBearer] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    getAccessTokenSilently()
      .then((token) => setBearer(token))
      .catch(() => setBearer(null));
  }, [getAccessTokenSilently]);

  const sendHydratedToken = useCallback(
    (token: Token, asset: string, visible: boolean) => {
      if (assets === undefined) return;
      if (api === undefined) return;
      if (scene === undefined) return;

      const instance: HydratedTokenInstance = {
        name: token.name,
        scene: scene._id!,
        visible,
        token: token._id!,
        asset: asset,
        x: 0,
        y: 0,
        scale: 1,
        angle: 0,
      };

      onToken(instance);
    },
    [api, assets, onToken, scene],
  );

  return (
    // , height: `calc(100vh - 72px)`
    <Box sx={{ overflow: "auto" }}>
      <TextField
        autoFocus
        label="Name"
        variant="standard"
        // if this ever hits the backend, it should debounce
        onChange={(
          event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => setSearchValue(event.target.value)}
        sx={{ m: 1, margin: "1em" }}
      ></TextField>
      <List>
        {tokens
          .filter(
            (token) =>
              searchValue === "" ||
              token.name.toLowerCase().includes(searchValue.toLowerCase()),
          )
          .map((token) => {
            const asset = assets?.find((a) => a._id === token.asset)?.location;
            const url = asset
              ? `${api}/${asset}${bearer ? `?token=${bearer}` : ""}`
              : "/x.webp";
            return (
              <ListItem
                key={token._id}
                secondaryAction={
                  <Tooltip title="Invisible token" placement="left">
                    <IconButton
                      edge="end"
                      aria-label="comments"
                      onClick={() => sendHydratedToken(token, url, false)}
                    >
                      <VisibilityOffIcon />
                    </IconButton>
                  </Tooltip>
                }
              >
                <Tooltip title="Visible token" placement="left">
                  <ListItemButton
                    onClick={() => sendHydratedToken(token, url, true)}
                  >
                    <ListItemAvatar>
                      <Avatar alt={`Avatar ${token.name}`} src={url} />
                    </ListItemAvatar>
                    <ListItemText primary={token.name}></ListItemText>
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
      </List>
    </Box>
  );
};

export default FindTokenComponent;
