import { useEffect } from "react";
import { GameMasterAction } from "../GameMasterActionComponent/GameMasterActionComponent";
// import styles from "./TokensComponent.module.css";
import { useDispatch, useSelector } from "react-redux";
import { Box, Grid } from "@mui/material";
import ErrorAlertComponent from "../ErrorAlertComponent/ErrorAlertComponent";
import { Token } from "@micahg/tbltp-common";
import AssetPanelComponent from "../AssetPanelComponent/AssetPanelComponent";
import { AppReducerState } from "../../reducers/AppReducer";
import CreateTokenFormComponent from "../CreateTokenFormComponent/CreateTokenFormComponent";

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
    dispatch({ type: "content/tokens" });
  }, [dispatch]);

  useEffect(() => {
    if (!populateToolbar) return;
    const actions: GameMasterAction[] = [];
    populateToolbar(actions);
  }, [tokens, dispatch, populateToolbar]);

  return (
    // 100vh - 64px for the toolbar - 8px for the paddings
    <Box sx={{ overflow: "auto", height: `calc(100vh - 72px)` }}>
      <ErrorAlertComponent />
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
