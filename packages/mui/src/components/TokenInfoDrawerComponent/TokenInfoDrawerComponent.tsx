// import styles from "./TokenInfoDrawerComponent.module.css";
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useState, Fragment } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import CreateTokenFormComponent from "../CreateTokenFormComponent/CreateTokenFormComponent.lazy";
import FindTokenComponent from "../FindTokenComponent/FindTokenComponent.lazy";
// interface TokenInfoDrawerComponentProps {}

const TokenInfoDrawerComponent = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const toggleSearch = () => setSearchOpen(!searchOpen);
  const toggleCreate = () => setCreateOpen(!createOpen);

  return (
    <Box>
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
        <ListItem key="create" onClick={handleClickOpen}>
          <ListItemButton>
            {/* {createOpen ? <ExpandLess /> : <ExpandMore />} */}
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Create Token" />
          </ListItemButton>
        </ListItem>
        {/* <Collapse in={createOpen} timeout="auto" unmountOnExit>
          <ListItem>
            <CreateTokenFormComponent />
          </ListItem>
        </Collapse> */}
      </List>
      <Fragment>
        <Dialog
          open={open}
          onClose={handleClose}
          PaperProps={{
            component: "form",
            onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const formJson = Object.fromEntries((formData as any).entries());
              const email = formJson.email;
              console.log(email);
              handleClose();
            },
          }}
        >
          <DialogTitle>Create Token</DialogTitle>
          <DialogContent>
            <CreateTokenFormComponent />
            {/* <DialogContentText>
              To subscribe to this website, please enter your email address
              here. We will send updates occasionally.
            </DialogContentText>
            <TextField
              autoFocus
              required
              margin="dense"
              id="name"
              name="email"
              label="Email Address"
              type="email"
              fullWidth
              variant="standard"
            /> */}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit">Subscribe</Button>
          </DialogActions>
        </Dialog>
      </Fragment>
    </Box>
  );
};

export default TokenInfoDrawerComponent;
