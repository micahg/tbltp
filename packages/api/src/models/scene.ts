import { Schema, model } from "mongoose";
import { Scene } from "@micahg/tbltp-common";

interface IScene
  extends Omit<
    Scene,
    "_id" | "user" | "tokens" | "playerId" | "detailId" | "overlayId"
  > {
  _id?: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  playerId?: Schema.Types.ObjectId;
  detailId?: Schema.Types.ObjectId;
  overlayId?: Schema.Types.ObjectId;
}

const SceneSchema = new Schema<IScene>(
  {
    user: { type: Schema.Types.ObjectId, required: true, index: true },
    description: { type: String, required: true },
    overlayId: { type: Schema.Types.ObjectId, required: false, ref: "Asset" },
    detailId: { type: Schema.Types.ObjectId, required: false, ref: "Asset" },
    playerId: { type: Schema.Types.ObjectId, required: false, ref: "Asset" },
    overlayContent: { type: String, required: false },
    overlayContentRev: { type: Number, required: false },
    detailContent: { type: String, required: false },
    detailContentRev: { type: Number, required: false },
    playerContent: { type: String, required: false },
    playerContentRev: { type: Number, required: false },
    angle: { type: Number, required: false },
    viewport: {
      type: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
      },
      required: false,
    },
    backgroundSize: {
      type: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
      },
      required: false,
    },
  },
  { timestamps: true },
);

const Scene = model<IScene>("Scene", SceneSchema);

export { Scene, IScene };
