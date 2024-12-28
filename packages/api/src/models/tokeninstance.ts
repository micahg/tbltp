import { Schema, model } from "mongoose";
import {
  TokenInstance as BasicTokenInstance,
  MAX_HP,
  MIN_HP,
} from "@micahg/tbltp-common";

export type TokenInstance = Omit<
  BasicTokenInstance,
  "_id" | "token" | "scene"
> & {
  _id?: Schema.Types.ObjectId;
  token: Schema.Types.ObjectId;
  scene: Schema.Types.ObjectId;
};

interface ITokenInstance extends TokenInstance {
  _id?: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  scene: Schema.Types.ObjectId;
  visible: boolean;
  hitPoints?: number;
  x: number;
  y: number;
  scale: number;
}

const TokenInstanceSchema = new Schema<ITokenInstance>(
  {
    token: { type: Schema.Types.ObjectId, required: true },
    scene: { type: Schema.Types.ObjectId, required: true },
    user: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    visible: { type: Boolean, default: false },
    hitPoints: {
      type: Number,
      required: false,
      min: [MIN_HP, "Hit-points too low"],
      max: [MAX_HP, "Hit-points too high"],
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    scale: { type: Number, required: true, default: 1 },
  },
  { timestamps: true },
);
TokenInstanceSchema.index({ user: 1, scene: 1 }, { unique: true });

const TokenInstanceModel = model<ITokenInstance>("Token", TokenInstanceSchema);

export { TokenInstanceModel, ITokenInstance };
