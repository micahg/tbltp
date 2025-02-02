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
import { useDispatch, useSelector } from "react-redux";
import { useCallback, useEffect, useState } from "react";
import { HydratedTokenInstance, Token } from "@micahg/tbltp-common";
// import styles from "./FindTokenComponent.module.css";

interface FindTokenComponentProps {
  // onToken: (token: HydratedToken) => void;
  onToken: (token: HydratedTokenInstance) => void;
}

const FindTokenComponent = ({ onToken }: FindTokenComponentProps) => {
  const dispatch = useDispatch();
  const tokens = useSelector((state: AppReducerState) => state.content.tokens);
  const assets = useSelector((state: AppReducerState) => state.content.assets);
  const scene = useSelector(
    (state: AppReducerState) => state.content.currentScene,
  );
  const mediaPrefix = useSelector(
    (state: AppReducerState) => state.content.mediaPrefix,
  );
  const bearer = useSelector(
    (state: AppReducerState) => state.environment.bearer,
  );
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (tokens === undefined) dispatch({ type: "content/tokens" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendHydratedToken = useCallback(
    (token: Token, asset: string, visible: boolean) => {
      if (assets === undefined) return;
      if (mediaPrefix === undefined) return;
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
    [assets, mediaPrefix, onToken, scene],
  );

  return (
    // , height: `calc(100vh - 72px)`
    <Box sx={{ overflow: "auto" }}>
      <TextField
        autoFocus
        label="Name"
        variant="standard"
        // if this ever hits the backend, it should debounce
        onChange={(event) => setSearchValue(event.target.value)}
        sx={{ m: 1, margin: "1em" }}
      ></TextField>
      <List>
        {tokens !== undefined &&
          tokens
            .filter(
              (token) =>
                searchValue === "" ||
                token.name.toLowerCase().includes(searchValue.toLowerCase()),
            )
            .map((token) => {
              const asset = assets?.find(
                (a) => a._id === token.asset,
              )?.location;
              const url = asset
                ? `${mediaPrefix}/${asset}${bearer ? `?token=${bearer}` : ""}`
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
