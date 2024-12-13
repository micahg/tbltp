import { Box, ListItem, ListSubheader, Paper, TextField } from "@mui/material";
import { AppReducerState } from "../../reducers/AppReducer";
import { useSelector } from "react-redux";
import { useEffect } from "react";
// import styles from "./FindTokenComponent.module.css";

// interface FindTokenComponentProps {}

const FindTokenComponent = () => {
  const tokens = useSelector((state: AppReducerState) => state.content.tokens);

  useEffect(() => {}, []);

  /**        {scenes.map((scene) => (
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
            } */
  return (
    // , height: `calc(100vh - 72px)`
    <Box sx={{ overflow: "auto" }}>
      <ListSubheader>
        <TextField
          autoFocus
          label="Name"
          variant="standard"
          // onChange={search}
          sx={{ m: 1, margin: "1em" }}
        ></TextField>
      </ListSubheader>
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
      {tokens.map((token) => (
        <ListItem key={token._id}>{token.name}</ListItem>
      ))}
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
    </Box>
  );
};

export default FindTokenComponent;
