import { Box, List, ListItem, TextField, ListItemButton } from "@mui/material";
import { AppReducerState } from "../../reducers/AppReducer";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { HydratedToken, Token } from "@micahg/tbltp-common";
// import styles from "./FindTokenComponent.module.css";

interface FindTokenComponentProps {
  onToken: (token: HydratedToken) => void;
}

const FindTokenComponent = ({ onToken }: FindTokenComponentProps) => {
  const dispatch = useDispatch();
  const tokens = useSelector((state: AppReducerState) => state.content.tokens);
  const assets = useSelector((state: AppReducerState) => state.content.assets);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (tokens === undefined) dispatch({ type: "content/tokens" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendHydratedToken = (token: Token) => {
    const asset = assets?.find((asset) => asset._id === token.asset);
    const hydratedToken: HydratedToken = {
      ...token,
      asset: asset,
    };
    onToken(hydratedToken);
  };

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
            .map((token) => (
              <ListItem key={token._id}>
                <ListItemButton onClick={() => sendHydratedToken(token)}>
                  {token.name}
                </ListItemButton>
              </ListItem>
            ))}
      </List>
    </Box>
  );
};

export default FindTokenComponent;
