import { Schema, model, Types } from "mongoose";

/**
 * User Interface.
 *
 * Each user has a sub (subject) from their JWT.
 */
interface IUser {
  _id?: Types.ObjectId;
  sub: string;
}

const UserSchema = new Schema<IUser>(
  {
    sub: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true },
);

const User = model<IUser>("User", UserSchema);

export { User, IUser };
