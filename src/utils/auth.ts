import * as https from "https";
import { log } from "./logger";
import { exit } from "process";

export function getOAuthPublicKey(): Promise<string> {
  if (process.env.DISABLE_AUTH?.toLowerCase() === "true") {
    return Promise.resolve(null);
  }

  const iss: string = process.env.ISSUER_URL || "https://nttdev.us.auth0.com";
  const pem: string = `${iss}/pem`;

  return new Promise((resolve, reject) => {
    try {
      // todo this fails less than gracefully offline
      https
        .get(pem, (res) => {
          if (res.statusCode !== 200)
            return reject(`Error fetching PEM: ${res.statusCode}`);
          let body = "";
          res.on("data", (data) => (body += data));
          res.on("end", () => resolve(body));
          res.on("error", (err) => reject(err));
        })
        .on("error", (err) => {
          log.error(`Unable to fetch Auth0 PEM: ${JSON.stringify(err)}`);
          exit(1);
        });
    } catch (err) {
      reject(err);
    }
  });
}

export function getFakeUser() {
  return "noauth|0";
}
