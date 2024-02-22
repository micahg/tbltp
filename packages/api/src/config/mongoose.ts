// import { MongoClient, Db } from "mongodb";
import { log } from "../utils/logger";
import mongoose, { Mongoose } from "mongoose";

/**
 * This is here so sinon can easily replace the connection string
 */
// ts-prune-ignore-next used in unit tests
export function getUrl(): string {
  return process.env.MONGO_URL || "mongodb://localhost:27017/tbltp";
}

export function connect(): Promise<Mongoose> {
  const options = {
    serverSelectionTimeoutMS: 5000,
  };
  const url = getUrl();
  log.info(`Connecting to mongo...`);
  return mongoose.connect(url, options);
}
