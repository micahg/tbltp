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
import { useState, Fragment } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import CreateTokenFormComponent from "../CreateTokenFormComponent/CreateTokenFormComponent.lazy";
import FindTokenComponent from "../FindTokenComponent/FindTokenComponent.lazy";
import { Token } from "@micahg/tbltp-common";

interface TokenInfoDrawerComponentProps {
  onToken: (token: Token) => void; // pass through for token selection
}

const TokenInfoDrawerComponent = ({
  onToken,
}: TokenInfoDrawerComponentProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const openCreate = () => setCreateOpen(true);

  const closeCreate = () => setCreateOpen(false);

  const toggleSearch = () => setSearchOpen(!searchOpen);

  return (
    <Box>
      <List>
        <ListItem key="search" onClick={toggleSearch}>
          <ListItemButton>
            {searchOpen ? <ExpandLess /> : <ExpandMore />}
            <ListItemIcon>
              <SearchIcon />
            </ListItemIcon>
            <ListItemText primary="Use Token" />
          </ListItemButton>
        </ListItem>
        <Collapse in={searchOpen} timeout="auto" unmountOnExit>
          <ListItem>
            <FindTokenComponent onToken={onToken} />
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
