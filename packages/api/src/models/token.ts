import { Schema, model } from "mongoose";
import { Token as BasicToken } from "@micahg/tbltp-common";

export type Token = Omit<BasicToken, "asset"> & {
  asset?: Schema.Types.ObjectId;
};

interface IToken extends Token {
  _id: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  visible: boolean;
  asset?: Schema.Types.ObjectId;
}

const TokenSchema = new Schema<IToken>(
  {
    user: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    visible: { type: Boolean, default: false },
    asset: { type: Schema.Types.ObjectId, required: false },
  },
  { timestamps: true },
);
TokenSchema.index({ user: 1, name: 1 }, { unique: true });

const TokenModel = model<IToken>("Token", TokenSchema);

export { TokenModel, IToken };
