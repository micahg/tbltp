import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
// import styles from "./DeleteWarningComponent.module.css";

interface DeleteWarningComponentProps {
  open: boolean;
  deletionType: string;
  handleClose: () => void;
  handleDelete: (force: boolean) => void;
}

const DeleteWarningComponent = ({
  open,
  deletionType,
  handleClose,
  handleDelete,
}: DeleteWarningComponentProps) => {
  return (
    <Box>
      <Dialog open={open}>
        <DialogTitle>Delete {deletionType}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <p>The following scenes are still using this token: </p>
            <p>
              Please confirm deletion of the token along with all instances
              within the scenes.
            </p>
          </DialogContentText>
          <DialogActions>
            <Button onClick={handleClose} autoFocus>
              Cancel
            </Button>
            <Button onClick={() => handleDelete(true)}>Delete</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DeleteWarningComponent;
