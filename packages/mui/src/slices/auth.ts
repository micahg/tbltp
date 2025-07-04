import { createSlice, PayloadAction } from "@reduxjs/toolkit";
// import { startListening } from "../middleware/ListenerMiddleware";

interface AuthState {
  authenticated?: boolean;
  authenticationDisabled?: boolean;
}

export const authSlice = createSlice({
  name: "auth",
  initialState: {} as AuthState,
  reducers: {
    setAuthenticated(state, action: PayloadAction<boolean>) {
      state.authenticated = action.payload;
    },
    // THIS DOESNT MAKE SENSE ANYMORE (moved to API)
    setAuthenticationDisabled(state, action: PayloadAction<boolean>) {
      state.authenticationDisabled = action.payload;
    },
    // // THIS SHOULDN"T BE USED ANYWHERE (cept bullshit, it is and I should rename it to track the actual auth state)
    // setDoAuthRenameThis(state, action: PayloadAction<boolean>) {
    //   // This is a placeholder for a future action to handle authentication state
    //   // Rename this action to something more meaningful when implemented
    //   state.authenticated = action.payload;
    // },
  },
});

export const {
  setAuthenticated,
  setAuthenticationDisabled,
  // setDoAuthRenameThis,
} = authSlice.actions;

// startListening({
//   actionCreator: setDoAuthRenameThis,
//   effect: (action, setDoAuthRenameThis) => {
//     const { payload } = action;
//     console.log(setDoAuthRenameThis);
//     if (payload) {
//       // Handle authenticated state change
//       console.log("User is authenticated");
//     } else {
//       // Handle unauthenticated state change
//       console.log("User is not authenticated");
//     }
//     setDoAuthRenameThis.dispatch(setAuthenticated(payload));
//   },
// });
