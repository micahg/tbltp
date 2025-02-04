import { useEffect } from "react";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
// import styles from "./TokensComponent.module.css";
import { useDispatch, useSelector } from "react-redux";
import { Box, Grid } from "@mui/material";
import { Add } from "@mui/icons-material";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent.lazy";
import { Token } from "@micahg/tbltp-common";
import { AppReducerState } from "../../reducers/AppReducer";
import CreateTokenFormComponent from "../CreateTokenFormComponent/CreateTokenFormComponent.lazy";
import { TwoMinuteTableTop } from "../CreateTokenFormComponent/CreateTokenFormComponent";

interface TokensComponentProps {
  populateToolbar?: (actions: GameMasterAction[]) => void;
}

const TokensComponent = ({ populateToolbar }: TokensComponentProps) => {
  const dispatch = useDispatch();
  const tokens = useSelector((state: AppReducerState) => {
    return state.content.tokens;
  });

  useEffect(() => {
    if (!dispatch) return;
    if (tokens) return; // tokens are undefined until they are fetched
    dispatch({ type: "content/tokens" });
  }, [tokens, dispatch]);

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [
      {
        icon: Add,
        tooltip: "Create Token",
        hidden: () => false,
        disabled: () => false,
        callback: () => {
          const name = `Token ${tokens?.length || 0}`;
          const token: Token = { name };
          dispatch({ type: "content/updatetoken", payload: token });
        },
      },
      {
        // work around infinite re-render (see the long blurb in
        // handlePopulateToolbar from GameMasterComponent.tsx)
        icon: Add,
        tooltip: JSON.stringify(tokens),
        hidden: () => true,
        disabled: () => true,
        callback: () => {},
      },
    ];

    populateToolbar(actions);
  }, [tokens, dispatch, populateToolbar]);

  return (
    // 100vh - 64px for the toolbar - 8px for the paddings
    <Box sx={{ overflow: "auto", height: `calc(100vh - 72px)` }}>
      <ErrorAlertComponent sticky={true} />
      <Box sx={{ paddingLeft: "12px", paddingRight: "12px" }}>
        <TwoMinuteTableTop />
      </Box>
      <Grid container columns={{ xs: 2, sm: 2, md: 2 }}>
        {tokens &&
          tokens.map((token: Token) => (
            <Box
              key={token._id}
              sx={{
                margin: "12px",
                boxShadow: 4,
                borderRadius: 2,
                padding: "1em",
              }}
            >
              <CreateTokenFormComponent token={token} />
            </Box>
          ))}
      </Grid>
    </Box>
  );
};

export default TokensComponent;
