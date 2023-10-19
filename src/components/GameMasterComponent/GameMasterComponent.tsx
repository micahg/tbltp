import { useEffect, useState } from 'react';
import { AppBar, AppBarProps, Box, Collapse, CssBaseline, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Toolbar, Typography, styled, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import PhotoIcon from '@mui/icons-material/Photo';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import MailIcon from '@mui/icons-material/Mail';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ContentEditor from '../ContentEditor/ContentEditor';
import GameMasterActionComponent, { GameMasterAction } from '../GameMasterActionComponent/GameMasterActionComponent';
import { useDispatch, useSelector } from 'react-redux';
import { AppReducerState } from '../../reducers/AppReducer';
import { ExpandLess, ExpandMore } from '@mui/icons-material';

interface GameMasterComponentProps {}

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

interface GameMasterAppBarProps extends AppBarProps {
  open?: boolean;
}

const GameMasterAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<GameMasterAppBarProps>(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

const GameMasterComponent = (props: GameMasterComponentProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [open, setOpen] = useState<boolean>(false);
  const [scenesOpen, setScenesOpen] = useState<boolean>(false);
  const [actions, setActions] = useState<GameMasterAction[]>([]);
  const [doot, setDoot] = useState<number>(0);
  const auth = useSelector((state: AppReducerState) => state.environment.auth);
  const noauth = useSelector((state: AppReducerState) => state.environment.noauth);
  const authClient = useSelector((state: AppReducerState) => state.environment.authClient);
  const scenes = useSelector((state: AppReducerState) => state.content.scenes);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleLogout = () => dispatch({type: 'environment/logout'});

  const handlePopulateToolbar = (newActions: GameMasterAction[]) => setActions(newActions);

  const handleRedrawToolbar = () => setDoot(doot + 1);

  const scenesClick = () => setScenesOpen(!scenesOpen);

  useEffect(() => {
    if (!dispatch) return;
    if (!authClient) return;
    if (noauth || auth) {
      dispatch({type: 'content/scenes'});
      return;
    }
    // if (noauth) return;
    // if (auth) return;
    dispatch({type: 'environment/authenticate'});
  }, [dispatch, noauth, auth, authClient])

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <GameMasterAppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ mr: 2, ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Persistent drawer
          </Typography>
          <GameMasterActionComponent actions={actions}/>
        </Toolbar>
      </GameMasterAppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
        <ListItem key="Campaigns" disablePadding>
            <ListItemButton>
              <ListItemIcon>
                <PhotoLibraryIcon/>
              </ListItemIcon>
              <ListItemText primary="Campaigns"/>
            </ListItemButton>
          </ListItem>
          <ListItem key="Scenes" disablePadding onClick={scenesClick}>
            <ListItemButton>
              <ListItemIcon>
                <PhotoIcon/>
              </ListItemIcon>
              <ListItemText primary="Scenes"/>
              {scenesOpen ? <ExpandLess/> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={scenesOpen} timeout="auto" unmountOnExit>
            <ListSubheader>
              <ListItemButton>
                <ListItemIcon>
                  <AddIcon/>
                </ListItemIcon>
                <ListItemText primary="Create Scene"/>
              </ListItemButton>
            </ListSubheader>
            {scenes.map((scene, index) => (
              <ListItem key={index} secondaryAction={
                <IconButton edge="end" aria-label="delete">
                  <DeleteIcon />
                </IconButton>
                }>
                <ListItemButton>
                  <ListItemText primary={scene.description} />
                </ListItemButton>
              </ListItem>
            ))}
            {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((value, index) => (
              <ListItem key={index} secondaryAction={
                <IconButton edge="end" aria-label="delete">
                  <DeleteIcon />
                </IconButton>
                }>
                <ListItemButton>
                  <ListItemText primary={value} />
                </ListItemButton>
              </ListItem>
            ))}
          </Collapse>
          <ListItem key="Log Out" disablePadding onClick={handleLogout}>
            <ListItemButton>
              <ListItemIcon>
                <LogoutIcon/>
              </ListItemIcon>
              <ListItemText primary="Log Out"/>
            </ListItemButton>
          </ListItem>
        </List>
        {/* <Divider />
        <List>
          {scenes.map((scene, index) => (
            <ListItem key={index}>
              <ListItemButton>
                <ListItemText primary={scene.description} />
              </ListItemButton>
            </ListItem>
          ))}
          {['All mail', 'Trash', 'Spam'].map((text, index) => (
            <ListItem key={text} disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
                </ListItemIcon>
                <ListItemText primary={text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider /> */}
      </Drawer>
      <Main open={open}>
        <DrawerHeader />
        <ContentEditor
          populateToolbar={handlePopulateToolbar}
          redrawToolbar={handleRedrawToolbar}
        />
      </Main>
    </Box>
  );
};

export default GameMasterComponent;
