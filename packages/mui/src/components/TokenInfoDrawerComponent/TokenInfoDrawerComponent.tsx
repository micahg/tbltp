// import styles from "./TokenInfoDrawerComponent.module.css";
import {
  Box,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import PlaceIcon from "@mui/icons-material/Place";
import DeleteIcon from "@mui/icons-material/Delete";
import { useState, Fragment } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import CreateTokenFormComponent from "../CreateTokenFormComponent/CreateTokenFormComponent.lazy";
import FindTokenComponent from "../FindTokenComponent/FindTokenComponent.lazy";
import { HydratedTokenInstance } from "@micahg/tbltp-common";

interface TokenInfoDrawerComponentProps {
  onToken: (token: HydratedTokenInstance) => void; // pass through for token selection
  closeDrawer?: () => void;
}

const TokenInfoDrawerComponent = ({
  onToken,
  closeDrawer,
}: TokenInfoDrawerComponentProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const openCreate = () => setCreateOpen(true);

  const closeCreate = () => setCreateOpen(false);

  const toggleSearch = () => setSearchOpen(!searchOpen);

  const tokenSelected = (token: HydratedTokenInstance) => {
    if (closeDrawer) closeDrawer();
    onToken(token);
  };

  return (
    <Box>
      <List>
        <ListItem key="search" onClick={toggleSearch}>
          <ListItemButton>
            {searchOpen ? <ExpandLess /> : <ExpandMore />}
            <ListItemIcon>
              <SearchIcon />
            </ListItemIcon>
            <ListItemText primary="Add Token" />
          </ListItemButton>
        </ListItem>
        <Collapse in={searchOpen} timeout="auto" unmountOnExit>
          <ListItem>
            <FindTokenComponent onToken={tokenSelected} />
          </ListItem>
          <Divider />
        </Collapse>
        <ListItem key="create" onClick={openCreate}>
          <ListItemButton>
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Create Token" />
          </ListItemButton>
        </ListItem>
        <ListItem key="move">
          <ListItemButton>
            <ListItemIcon>
              <PlaceIcon />
            </ListItemIcon>
            {/* import ControlCameraIcon from '@mui/icons-material/ControlCamera'; */}
            <ListItemText primary="Move Token" />
          </ListItemButton>
        </ListItem>
        <ListItem key="delete">
          <ListItemButton>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText primary="Delete Token" />
          </ListItemButton>
        </ListItem>
      </List>
      <Fragment>
        <Dialog open={createOpen} onClose={closeCreate}>
          <DialogTitle>Create Token</DialogTitle>
          <DialogContent>
            <CreateTokenFormComponent modal={true} />
          </DialogContent>
        </Dialog>
      </Fragment>
    </Box>
  );
};

export default TokenInfoDrawerComponent;
