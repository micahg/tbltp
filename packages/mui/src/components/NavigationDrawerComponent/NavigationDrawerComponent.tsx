import {
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
} from "@mui/material";
// import styles from "./NavigationDrawerComponent.module.css";
import { Scene } from "../../reducers/ContentReducer";
import { useDispatch, useSelector } from "react-redux";
import { ExpandLess, ExpandMore, UploadFile } from "@mui/icons-material";
import PhotoIcon from "@mui/icons-material/Photo";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { AppReducerState } from "../../reducers/AppReducer";

interface NavigationDrawerComponentProps {
  scenesOpen: boolean;
  handleViewAssets: () => void;
  handleCreateScene: () => void;
  handleEditScene: (scene?: Scene) => void;
  scenesClick: () => void;
}

const NavigationDrawerComponent = ({
  scenesOpen,
  handleViewAssets,
  handleCreateScene,
  handleEditScene,
  scenesClick,
}: NavigationDrawerComponentProps) => {
  const dispatch = useDispatch();

  const handleDeleteScene = (scene: Scene) => {
    dispatch({ type: "content/deletescene", payload: scene });
  };

  const handleLogout = () => dispatch({ type: "environment/logout" });

  const scenes = useSelector((state: AppReducerState) => state.content.scenes);

  return (
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
  );
};

export default NavigationDrawerComponent;
