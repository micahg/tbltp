import { IUser, User } from "../models/user";

import { AuthResult } from "express-oauth2-jwt-bearer";

export function userExistsOr401(user: IUser) {
  if (!user) throw new Error("No user", { cause: 401 });
  return user;
}

export async function getUserByID(user: string): Promise<IUser> {
  return User.findOne({ sub: user });
}
export async function getUser(auth: AuthResult): Promise<IUser> {
  return getUserByID(auth.payload.sub);
}

async function createUser(auth: AuthResult) {
  return User.create({ sub: auth.payload.sub });
  // req.auth = {
  //   payload: {
  //     iss: "https://nttdev.us.auth0.com/",
  //     sub: "google-oauth2|107376453871279430700",
  //     aud: [
  //       "http://localhost:3000/",
  //       "https://nttdev.us.auth0.com/userinfo",
  //     ],
  //     iat: 1696460361,
  //     exp: 1696546761,
  //     azp: "blFghGfwUHOlKwDZzOELBFmxOTkxCeQr",
  //     scope: "openid profile email",
  //   },
  //   header: {
  //     alg: "RS256",
  //     typ: "JWT",
  //     kid: "tqTuXQ6GzoJwt39xmPTFn",
  //   },
  //   token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRxVHVYUTZHem9Kd3QzOXhtUFRGbiJ9.eyJpc3MiOiJodHRwczovL250dGRldi51cy5hdXRoMC5jb20vIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMDczNzY0NTM4NzEyNzk0MzA3MDAiLCJhdWQiOlsiaHR0cDovL2xvY2FsaG9zdDozMDAwLyIsImh0dHBzOi8vbnR0ZGV2LnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE2OTY0NjAzNjEsImV4cCI6MTY5NjU0Njc2MSwiYXpwIjoiYmxGZ2hHZndVSE9sS3dEWnpPRUxCRm14T1RreENlUXIiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIn0.MFS7Lx3EgIsx5TJciGD-C9h6Bfn42FuZcrVCQkTRwieJL87hDZPYg7e6TBR8xh-bttnfogewAvy3RHcfwJQaUtQYrJbixFk-Rnc9L94adBz7TSthOcOQTy8fb6pOYDkGSDGwVXUBOXIYExT-dezM2ZSscHYXE8227rGsgtCUXSSG3N8FMiUstHnZ6fLTQS6iwDlhcuq1-2loJxCVGH3Aiixh6F391JqO7o1JdHA-ZlSOHEfC4pChD14kf1okNevlk8s9Cikwiy2jeDym1N_iRJTIRLLmtIEQF5VGsVXlvo5ltUQ568-00Vc7sKDrVZTxWWsCbrnKe3QbxYZMz9e5fQ",
  // }
}

export function getOrCreateUser(auth: AuthResult): Promise<IUser> {
  return getUser(auth).then((user) => {
    if (user) return user;
    return createUser(auth);
  });
}
