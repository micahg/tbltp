// import styles from "./TokenInfoDrawerComponent.module.css";
import {
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useState } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import CreateTokenFormComponent from "../CreateTokenFormComponent/CreateTokenFormComponent.lazy";
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
          <TextField
            autoFocus
            label="Name"
            variant="standard"
            // onChange={search}
            sx={{ m: 1, margin: "1em" }}
          ></TextField>
          {/* <TextField
        variant="standard"
        label="Class"
        defaultValue=""
        disabled={classes.length === 0}
        select
        onChange={(event) => setClassSelected(event.target.value)}
        sx={{ m: 1, margin: "1em" }}
      >
        {classes.map((classroom: ClassRoom) => (
          <MenuItem key={classroom._id} value={classroom._id}>
            {classroomText(classroom)}
          </MenuItem>
        ))}
      </TextField> */}
          {/* <SearchResultsList
        value={searchValue}
        onSelected={(student: Student) => selected(student)}
      /> */}
          {/* The text field above is 3.5em, so we shrink the paper by 3.5em and let it handle overflow
      to keep the scrolling to within the list it contains. */}
          <Paper
            sx={{
              display: "flex",
              justifyContent: "left",
              flexWrap: "wrap",
              listStyle: "none",
              padding: 0,
              margin: "0 0 3.5em 0",
              overflow: "auto",
            }}
            component="ul"
            elevation={0}
          ></Paper>
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
