import { Box, List, ListItem, TextField, ListItemButton } from "@mui/material";
import { AppReducerState } from "../../reducers/AppReducer";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
// import styles from "./FindTokenComponent.module.css";

import { Token } from "@micahg/tbltp-common";
// interface FindTokenComponentProps {}

const FindTokenComponent = () => {
  const dispatch = useDispatch();
  const tokens = useSelector((state: AppReducerState) => state.content.tokens);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (tokens === undefined) dispatch({ type: "content/tokens" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // , height: `calc(100vh - 72px)`
    <Box sx={{ overflow: "auto" }}>
      <TextField
        autoFocus
        label="Name"
        variant="standard"
        // if this ever hits the backend, it should debounce
        onChange={(event) => setSearchValue(event.target.value)}
        sx={{ m: 1, margin: "1em" }}
      ></TextField>
      <List>
        {tokens !== undefined &&
          tokens
            .filter(
              (token) =>
                searchValue === "" ||
                token.name.toLowerCase().includes(searchValue.toLowerCase()),
            )
            .map((token) => (
              <ListItem key={token._id}>
                <ListItemButton>{token.name}</ListItemButton>
              </ListItem>
            ))}
      </List>

      {/* <ListItem
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
          > */}
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
      {/* <Paper
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
      ></Paper> */}
    </Box>
  );
};

export default FindTokenComponent;
