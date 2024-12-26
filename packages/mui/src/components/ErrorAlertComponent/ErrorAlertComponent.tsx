import { Alert, Box, IconButton } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { AppReducerState } from "../../reducers/AppReducer";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect } from "react";

interface ErrorAlertComponentProps {
  sticky?: boolean;
}

const ErrorAlertComponent = ({ sticky }: ErrorAlertComponentProps) => {
  const dispatch = useDispatch();
  const error = useSelector((state: AppReducerState) => state.content.err);

  console.log(`sticky: ${sticky}`);

  useEffect(() => {
    // clear the error if there is one
    return () => {
      dispatch({ type: "content/error" });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      sx={{
        position: sticky === true ? "sticky" : "relative",
        top: sticky === true ? "6px" : undefined,
        padding: sticky === true ? "12px" : undefined,
        width: "100%",
      }}
    >
      {error?.success === false && (
        <Alert
          severity="error"
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                dispatch({ type: "content/error" });
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {error.msg}
        </Alert>
      )}
      {error?.success === true && (
        <Alert
          severity="success"
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                dispatch({ type: "content/error" });
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {error.msg}
        </Alert>
      )}
    </Box>
  );
};
export default ErrorAlertComponent;
