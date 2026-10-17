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
import { useSelector } from "react-redux";
import { ChangeEvent, useCallback, useState } from "react";
import { HydratedTokenInstance, Token } from "@micahg/tbltp-common";
import { useGetScenesQuery } from "../../api/scene";
import { selectEditingSceneId } from "../../slices/editorUiSlice";
import { useGetTokensQuery } from "../../api/token";
import { useGetAssetsQuery } from "../../api/asset";
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
  const [searchValue, setSearchValue] = useState("");

  const sendHydratedToken = useCallback(
    (
      token: Token,
      assetLocation: string,
      assetUrl: string,
      visible: boolean,
    ) => {
      if (scene === undefined) return;

      const instance: HydratedTokenInstance = {
        name: token.name,
        scene: scene._id!,
        visible,
        token: token._id!,
        asset: assetLocation,
        assetUrl: assetUrl,
        x: 0,
        y: 0,
        scale: 1,
        angle: 0,
      };

      onToken(instance);
    },
    [onToken, scene],
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
            const asset = assets?.find((a) => a._id === token.asset);
            // assetless tokens get the standing placeholder; token images
            // are fetched through presigned urls like every other asset
            const assetLocation = asset?.location || "/x.webp";
            const url = asset?.url || "/x.webp";
            return (
              <ListItem
                key={token._id}
                secondaryAction={
                  <Tooltip title="Invisible token" placement="left">
                    <IconButton
                      edge="end"
                      aria-label="comments"
                      onClick={() =>
                        sendHydratedToken(token, assetLocation, url, false)
                      }
                    >
                      <VisibilityOffIcon />
                    </IconButton>
                  </Tooltip>
                }
              >
                <Tooltip title="Visible token" placement="left">
                  <ListItemButton
                    onClick={() =>
                      sendHydratedToken(token, assetLocation, url, true)
                    }
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
