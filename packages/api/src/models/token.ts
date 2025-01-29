import { Schema, model } from "mongoose";
import { Token as BasicToken, MAX_HP, MIN_HP } from "@micahg/tbltp-common";

export type Token = Omit<BasicToken, "_id" | "asset"> & {
  asset?: Schema.Types.ObjectId;
};

interface IToken extends Token {
  _id?: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  visible: boolean;
  asset?: Schema.Types.ObjectId;
  hitPoints?: number;
}

const TokenSchema = new Schema<IToken>(
  {
    user: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    visible: { type: Boolean, default: false },
    asset: { type: Schema.Types.ObjectId, required: false, ref: "Asset" },
    hitPoints: {
      type: Number,
      required: false,
      min: [MIN_HP, "Hit-points too low"],
      max: [MAX_HP, "Hit-points too high"],
    },
  },
  { timestamps: true },
);
TokenSchema.index({ user: 1, name: 1 }, { unique: true });

const TokenModel = model<IToken>("Token", TokenSchema);

export { TokenModel, IToken };
