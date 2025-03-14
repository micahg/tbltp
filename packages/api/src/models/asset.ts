import { Schema, model } from "mongoose";
import { Asset as BasicAsset } from "@micahg/tbltp-common";

export type Asset = Omit<BasicAsset, "_id" | "user"> & {
  asset?: Schema.Types.ObjectId;
};

interface IAsset extends Asset {
  _id?: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
}

const AssetSchema = new Schema<IAsset>(
  {
    user: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    location: { type: String },
    revision: { type: Number, default: 0 },
  },
  { timestamps: true },
);
AssetSchema.index({ user: 1, name: 1 }, { unique: true });

const AssetModel = model<IAsset>("Asset", AssetSchema);

export { AssetModel, IAsset };
