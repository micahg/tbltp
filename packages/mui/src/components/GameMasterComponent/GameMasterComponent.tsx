import { useEffect, useState } from "react";
import {
  AppBar,
  AppBarProps,
  Box,
  Collapse,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
  styled,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PhotoIcon from "@mui/icons-material/Photo";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ContentEditor from "../ContentEditor/ContentEditor.lazy";
import GameMasterActionComponent, {
  GameMasterAction,
} from "../GameMasterActionComponent/GameMasterActionComponent";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import { ExpandLess, ExpandMore, UploadFile } from "@mui/icons-material";
import SceneComponent from "../SceneComponent/SceneComponent.lazy";
import { Scene } from "../../reducers/ContentReducer";
import AssetsComponent from "../AssetsComponent/AssetsComponent.lazy";

const drawerWidth = 240;
const appBarHeight = 64;

enum FocusedComponent {
  ContentEditor,
  Scene,
  Assets,
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
  const [open, setOpen] = useState<boolean>(false);
  const [scenesOpen, setScenesOpen] = useState<boolean>(false);
  const [actions, setActions] = useState<GameMasterAction[]>([]);
  const [doot, setDoot] = useState<number>(0);
  // scene key is used to force rerender of scene creation component
  const [sceneKey, setSceneKey] = useState<number>(0);
  const [sceneCount, setSceneCount] = useState<number>(0);
  const [focusedComponent, setFocusedComponent] = useState<FocusedComponent>(
    FocusedComponent.ContentEditor,
  );
  const auth = useSelector((state: AppReducerState) => state.environment.auth);
  const noauth = useSelector(
    (state: AppReducerState) => state.environment.noauth,
  );
  const authClient = useSelector(
    (state: AppReducerState) => state.environment.authClient,
  );
  const scenes = useSelector((state: AppReducerState) => state.content.scenes);
  const currentScene = useSelector(
    (state: AppReducerState) => state.content.currentScene,
  );

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleCreateScene = (/*event: React.MouseEvent<HTMLElement>*/) => {
    // bump the scene key so the scene component state resets
    setSceneKey(sceneKey + 1);

    // unset the current scene
    dispatch({ type: "content/currentscene" });

    // display the scene component
    setFocusedComponent(FocusedComponent.Scene);
  };

  const handleViewAssets = () => {
    setFocusedComponent(FocusedComponent.Assets);
  };

  const handleEditScene = (scene?: Scene) => {
    if (scene) dispatch({ type: "content/currentscene", payload: scene });
    setFocusedComponent(FocusedComponent.ContentEditor);
  };

  const handleManageScene = () => {
    setFocusedComponent(FocusedComponent.Scene);
  };

  const handleDeleteScene = (scene: Scene) => {
    dispatch({ type: "content/deletescene", payload: scene });
  };

  const handleLogout = () => dispatch({ type: "environment/logout" });

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
    if (!dispatch) return;
    if (!noauth && !authClient) return;
    if (noauth || auth) {
      dispatch({ type: "content/scenes" });
      return;
    }
    // if (noauth) return;
    // if (auth) return;
    dispatch({ type: "environment/authenticate" });
  }, [dispatch, noauth, auth, authClient]);

  useEffect(() => {
    if (scenes.length === sceneCount) return;

    // if we added a scene, increase the key so we redraw the scene component
    if (scenes.length > sceneCount) setSceneKey(sceneKey + 1);

    // keep the count in sync
    setSceneCount(scenes.length);
  }, [sceneCount, sceneKey, scenes]);

  return (
    <Box sx={{ display: "flex", width: "100vw", height: "100vh" }}>
      <CssBaseline />
      <GameMasterAppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ mr: 2, ...(open && { display: "none" }) }}
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
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === "ltr" ? (
              <ChevronLeftIcon />
            ) : (
              <ChevronRightIcon />
            )}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          <ListItem key="Assets" disablePadding onClick={handleViewAssets}>
            <ListItemButton>
              <ListItemIcon>
                <UploadFile />
              </ListItemIcon>
              <ListItemText primary="Assets" />
            </ListItemButton>
          </ListItem>
          <ListItem key="Campaigns" disablePadding>
            <ListItemButton>
              <ListItemIcon>
                <PhotoLibraryIcon />
              </ListItemIcon>
              <ListItemText primary="Campaigns" />
            </ListItemButton>
          </ListItem>
          <ListItem key="Scenes" disablePadding onClick={scenesClick}>
            <ListItemButton>
              <ListItemIcon>
                <PhotoIcon />
              </ListItemIcon>
              <ListItemText primary="Scenes" />
              {scenesOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={scenesOpen} timeout="auto" unmountOnExit>
            <ListSubheader>
              <ListItemButton onClick={() => handleCreateScene()}>
                <ListItemIcon>
                  <AddIcon />
                </ListItemIcon>
                <ListItemText primary="Create Scene" />
              </ListItemButton>
            </ListSubheader>
            {scenes.map((scene) => (
              <ListItem
                key={scene._id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteScene(scene)}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => handleEditScene(scene)}>
                  <ListItemText primary={scene.description} />
                </ListItemButton>
              </ListItem>
            ))}
          </Collapse>
          <ListItem key="Log Out" disablePadding onClick={handleLogout}>
            <ListItemButton>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Log Out" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      <Main open={open}>
        {focusedComponent === FocusedComponent.ContentEditor && (
          <ContentEditor
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
      </Main>
    </Box>
  );
};

export default GameMasterComponent;
