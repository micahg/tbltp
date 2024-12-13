// import styles from "./TokenInfoDrawerComponent.module.css";
import {
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useState } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import CreateTokenFormComponent from "../CreateTokenFormComponent/CreateTokenFormComponent.lazy";
import FindTokenComponent from "../FindTokenComponent/FindTokenComponent.lazy";
// interface TokenInfoDrawerComponentProps {}

const TokenInfoDrawerComponent = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const toggleSearch = () => setSearchOpen(!searchOpen);
  const toggleCreate = () => setCreateOpen(!createOpen);

  return (
    <List>
      <ListItem key="search" onClick={toggleSearch}>
        <ListItemButton>
          {searchOpen ? <ExpandLess /> : <ExpandMore />}
          <ListItemIcon>
            <SearchIcon />
          </ListItemIcon>
          <ListItemText primary="Add Existing" />
        </ListItemButton>
      </ListItem>
      <Collapse in={searchOpen} timeout="auto" unmountOnExit>
        <ListItem>
          <FindTokenComponent />
        </ListItem>
        <Divider />
      </Collapse>
      <ListItem key="create" onClick={toggleCreate}>
        <ListItemButton>
          {createOpen ? <ExpandLess /> : <ExpandMore />}
          <ListItemIcon>
            <AddIcon />
          </ListItemIcon>
          <ListItemText primary="Create Token" />
        </ListItemButton>
      </ListItem>
      <Collapse in={createOpen} timeout="auto" unmountOnExit>
        <ListItem>
          <CreateTokenFormComponent />
        </ListItem>
      </Collapse>
    </List>
  );
};

export default TokenInfoDrawerComponent;
