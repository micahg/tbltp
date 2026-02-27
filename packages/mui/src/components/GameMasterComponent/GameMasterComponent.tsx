import { useEffect, useState, ReactElement, cloneElement } from "react";
import {
  AppBar,
  AppBarProps,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  styled,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContentEditor from "../ContentEditor/ContentEditor.lazy";
import GameMasterActionComponent, {
  GameMasterAction,
} from "../GameMasterActionComponent/GameMasterActionComponent";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import SceneComponent from "../SceneComponent/SceneComponent.lazy";
import AssetsComponent from "../AssetsComponent/AssetsComponent.lazy";
import NavigationDrawerComponent from "../NavigationDrawerComponent/NavigationDrawerComponent.lazy";
import TokensComponent from "../TokensComponent/TokensComponent.lazy";
import { Scene } from "@micahg/tbltp-common";
import {
  useGetEnvironmentConfigQuery,
  useGetNoAuthConfigQuery,
} from "../../api/environment";
import { useAuth0 } from "@auth0/auth0-react";
import {
  selectRatelimit,
  selectRatelimitMax,
  selectRatelimitRemaining,
} from "../../slices/rateLimitSlice";

const drawerWidth = 240;
const appBarHeight = 64;

enum FocusedComponent {
  ContentEditor,
  Scene,
  Assets,
  Tokens,
}

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(1),
  transition: theme.transitions.create("margin", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
  marginTop: `${appBarHeight}px`,
}));

interface GameMasterAppBarProps extends AppBarProps {
  open?: boolean;
}

const GameMasterAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<GameMasterAppBarProps>(({ theme, open }) => ({
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: "flex-end",
}));

const GameMasterComponent = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [navOpen, setNavOpen] = useState<boolean>(false);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [infoComponent, setInfoComponent] = useState<ReactElement | null>(null);
  const [scenesOpen, setScenesOpen] = useState<boolean>(false);
  const [actions, setActions] = useState<GameMasterAction[]>([]);
  const [doot, setDoot] = useState<number>(0);
  // scene key is used to force rerender of scene creation component
  const [sceneKey, setSceneKey] = useState<number>(0);
  const [sceneCount, setSceneCount] = useState<number>(0);
  const [focusedComponent, setFocusedComponent] = useState<FocusedComponent>(
    FocusedComponent.ContentEditor,
  );
  const [bearer, setBearer] = useState<string | null>(null);
  const { data: environmentConfig } = useGetEnvironmentConfigQuery();
  const { data: noAuthConfig } = useGetNoAuthConfigQuery(undefined, {
    skip: !environmentConfig?.api,
  });
  const noauth = noAuthConfig?.noauth ?? false;
  const scenes = useSelector((state: AppReducerState) => state.content.scenes);
  const currentScene = useSelector(
    (state: AppReducerState) => state.content.currentScene,
  );
  const rateMax = useSelector(selectRatelimitMax);
  const rateRemaining = useSelector(selectRatelimitRemaining);
  const rateLimit = useSelector(selectRatelimit);

  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();

  const handleNavDrawerOpen = () => setNavOpen(true);

  const handleNavDrawerClose = () => setNavOpen(false);

  const handleInfoDrawerOpen = (info: ReactElement) => {
    // inject this drawers close method into the info component
    const closableInfo = cloneElement(info, {
      closeDrawer: handleInfoDrawerClose,
    });
    setInfoComponent(closableInfo);
    setInfoOpen(true);
  };

  const handleInfoDrawerClose = () => {
    setInfoOpen(false);
    setInfoComponent(null);
  };

  const handleCreateScene = (/*event: React.MouseEvent<HTMLElement>*/) => {
    // bump the scene key so the scene component state resets
    setSceneKey(sceneKey + 1);

    // unset the current scene
    dispatch({ type: "content/currentscene" });

    // display the scene component
    setFocusedComponent(FocusedComponent.Scene);
  };

  const handleViewTokens = () => setFocusedComponent(FocusedComponent.Tokens);
  const handleViewAssets = () => setFocusedComponent(FocusedComponent.Assets);

  const handleEditScene = (scene?: Scene) => {
    if (scene) dispatch({ type: "content/currentscene", payload: scene });
    setFocusedComponent(FocusedComponent.ContentEditor);
  };

  const handleManageScene = () => {
    setFocusedComponent(FocusedComponent.Scene);
  };

  const handlePopulateToolbar = (newActions: GameMasterAction[]) => {
    /**************************************************************************
     * OOOOOOhhh boy, lots to discuss here. OK, so, the issue with the toolbar
     * and its state updates is that it can trigger an infinite render loop if
     * we're not careful, which leads me to believe we're doing it wrong.......
     *
     * handlePopulateToolbar is passed to whichever component is on screen so
     * it can add its bits to the toolbar. But, when they call back, we update
     * actions, which triggers a rerender of the toolbar, which triggers a
     * rerender of the component, which triggers a rerender of the toolbar, etc.
     *
     * To avoid this catastrophe, we only update when the deepish comparison of
     * actions shows that they've changed.
     *
     * But what shall we do when the child components state changes but can't
     * be represented by the action? The hack workaround is to create an
     * invisible action (hidden=true, disabled=true) that with a tooltip
     * that is the JSON.stringify of the state, so when we compare it to the
     * old one its different.
     *
     * For an example of this, check out the AssetsComponent
     **************************************************************************/
    let updateRequired = false;
    if (actions.length !== newActions.length) updateRequired = true;
    for (let i = 0; i < actions.length && !updateRequired; i++) {
      if (
        actions[i].icon !== newActions[i].icon ||
        actions[i].tooltip !== newActions[i].tooltip ||
        actions[i].hidden.toString() !== newActions[i].hidden.toString() ||
        actions[i].disabled.toString() !== newActions[i].disabled.toString() ||
        actions[i].callback.toString() !== newActions[i].callback.toString()
      ) {
        updateRequired = true;
      }
    }
    if (updateRequired) {
      return setActions(newActions);
    }
  };

  const handleRedrawToolbar = () => setDoot(doot + 1);

  const scenesClick = () => setScenesOpen(!scenesOpen);

  useEffect(() => {
    getAccessTokenSilently()
      .then((token) => {
        console.log("got token in content editor", token);
        setBearer(token);
      })
      .catch((err) => {
        setBearer(null);
        const authError =
          typeof err === "object" && err !== null && "error" in err
            ? String((err as { error?: unknown }).error)
            : undefined;
        if (
          authError === "login_required" ||
          authError === "interaction_required" ||
          authError === "consent_required"
        ) {
          const options = {
            authorizationParams: { redirect_uri: window.location.href },
          };
          void loginWithRedirect(options);
        }
        console.error("error getting token in content editor", {
          authError,
          err,
        });
      });
  }, [getAccessTokenSilently, loginWithRedirect]);

  useEffect(() => {
    if (!dispatch) return;

    if (noauth || bearer) {
      dispatch({ type: "content/pull" });
      dispatch({ type: "content/scenes" });
      dispatch({ type: "content/tokens" });
      dispatch({ type: "content/assets" });
      return;
    }
  }, [dispatch, noauth, bearer]);

  useEffect(() => {
    if (scenes.length === sceneCount) return;

    // if we added a scene, increase the key so we redraw the scene component
    if (scenes.length > sceneCount) setSceneKey(sceneKey + 1);

    // keep the count in sync
    setSceneCount(scenes.length);
  }, [sceneCount, sceneKey, scenes]);

  /**
   * Load all the scene tokens
   */
  useEffect(() => {
    if (scenes.length === 0) return;
    for (const scene of scenes) {
      if (scene.tokens === undefined) {
        dispatch({
          type: "content/scenetokens",
          payload: { scene: scene._id },
        });
      }
    }
  }, [dispatch, scenes]);

  return (
    <Box sx={{ display: "flex", width: "100vw", height: "100vh" }}>
      <CssBaseline />
      <GameMasterAppBar position="fixed" open={navOpen}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleNavDrawerOpen}
            edge="start"
            sx={{ mr: 2, ...(navOpen && { display: "none" }) }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Network Table Top
          </Typography>
          <GameMasterActionComponent key={doot} actions={actions} />
        </Toolbar>
      </GameMasterAppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
        variant="persistent"
        anchor="left"
        open={navOpen}
      >
        <DrawerHeader>
          <IconButton onClick={handleNavDrawerClose}>
            {theme.direction === "ltr" ? (
              <ChevronLeftIcon />
            ) : (
              <ChevronRightIcon />
            )}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <NavigationDrawerComponent
          scenesOpen={scenesOpen}
          scenesClick={scenesClick}
          handleEditScene={handleEditScene}
          handleCreateScene={handleCreateScene}
          handleViewAssets={handleViewAssets}
          handleViewTokens={handleViewTokens}
        />
      </Drawer>
      <Drawer
        open={infoOpen}
        anchor="right"
        onClose={handleInfoDrawerClose}
        sx={{
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            margin: "6px",
            borderRadius: "6px",
            height: "calc(100% - 12px)",
          },
        }}
      >
        {infoComponent}
      </Drawer>
      <Main open={navOpen}>
        {focusedComponent === FocusedComponent.ContentEditor && (
          <ContentEditor
            infoDrawer={handleInfoDrawerOpen}
            populateToolbar={handlePopulateToolbar}
            redrawToolbar={handleRedrawToolbar}
            manageScene={handleManageScene}
          />
        )}
        {focusedComponent === FocusedComponent.Scene && (
          <SceneComponent
            key={sceneKey} // increments on ever new scene press to reset state
            populateToolbar={handlePopulateToolbar}
            redrawToolbar={handleRedrawToolbar}
            scene={currentScene}
            editScene={handleEditScene}
          />
        )}
        {focusedComponent === FocusedComponent.Assets && (
          <AssetsComponent populateToolbar={handlePopulateToolbar} />
        )}
        {focusedComponent === FocusedComponent.Tokens && (
          <TokensComponent populateToolbar={handlePopulateToolbar} />
        )}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: "rgba(255, 255, 255, 1)",
          }}
        >
          Max: {rateMax}, Remaining: {rateRemaining}, Limit: {rateLimit}
        </Box>
      </Main>
    </Box>
  );
};

export default GameMasterComponent;
