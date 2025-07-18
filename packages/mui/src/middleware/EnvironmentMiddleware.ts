import { getAuthClient } from "../utils/auth";
import { Middleware } from "redux";

export const EnvironmentMiddleware: Middleware =
  (storeAPI) => (next) => async (action) => {
    if (action.type === "environment/logout") {
      getAuthClient(storeAPI)
        .then((client) => client.logout())
        .then(() => console.log("Successfully logged out"))
        .catch((err) =>
          console.error(`UNABLE TO LOG OUT: ${JSON.stringify(err)}`),
        );
    } else {
      return next(action);
    }
  };
